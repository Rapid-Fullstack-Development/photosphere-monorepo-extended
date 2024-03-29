import { createServer } from "../server";
import * as fs from "fs-extra";
import { ObjectId } from "mongodb";
import dayjs from "dayjs";
import { Readable } from "stream";
import { AddressInfo } from "net";
import axios from "axios";
import http from "http";

describe("photosphere backend", () => {

    const dateNow = dayjs("2023-02-08T01:27:01.419Z").toDate();

    let servers: http.Server[] = [];

    //
    // Initialises the server for testing.
    //
    async function initServer() {

        const mockCollection: any = {
            find() {
                return {
                    sort() {
                        return {
                            toArray() {
                                return [];
                            }
                        };
                    }
                };
            },

            findOne() {
            },

            createIndex() {
            },
        };

        const mockDb: any = {
            collection() {
                return mockCollection;
            },
        };

        const mockStorage: any = {
            init() {

            },
        };

        const app = await createServer(mockDb, () => dateNow, mockStorage);

        const server = app.listen();
        servers.push(server);

        const address = server.address() as AddressInfo;
        const baseUrl = `http://localhost:${address.port}`;

        return { app, server, baseUrl, mockCollection, mockDb, mockStorage };        
    }

    beforeAll(() => {
        axios.defaults.validateStatus = () => {
            return true;
        };
    });
  
    afterEach(() => {
        for (const server of servers) {
            server.close();
        }
        servers = [];
    });
    
    //
    // Creates a readable stream from a string.
    //
    function stringStream(content: string) {
        let contentSent = false;
        const stream = new Readable({
            read() {
                if (contentSent) {
                    this.push(null);
                }
                else {
                    this.push(content);
                    contentSent = true;
                }
            },
        });
        return stream;
    }
    
    test("no assets", async () => {
        const { baseUrl } = await initServer();
        const response = await axios.get(`${baseUrl}/assets`);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ assets: [] });
    });

    test("upload asset metadata", async () => {

        const { baseUrl, mockCollection } = await initServer();

        mockCollection.insertOne = jest.fn();

        const metadata = {
            fileName: "a-test-file.jpg",
            contentType: "image/jpeg",
            width: 256,
            height: 1024,
            hash: "1234",
            location: "Somewhere",
            fileDate: "2023-02-08T01:24:02.947Z",
            photoDate: "2023-02-08T01:28:26.735Z",
            properties: {
                "a": "property",
            },
            labels: [
                "Cool photo",
            ],
        };

        const response = await axios.post(`${baseUrl}/metadata`, metadata);

        const assetId = response.data.assetId;

        expect(response.status).toBe(200);
        expect(assetId).toBeDefined();
        expect(assetId.length).toBeGreaterThan(0);

        expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);
        expect(mockCollection.insertOne).toHaveBeenCalledWith({
            _id: new ObjectId(assetId),
            origFileName: metadata.fileName,
            width: metadata.width,
            height: metadata.height,
            hash: metadata.hash,
            location: metadata.location,
            properties: metadata.properties,
            fileDate: dayjs(metadata.fileDate).toDate(),
            photoDate: dayjs(metadata.photoDate).toDate(),
            sortDate: dayjs(metadata.photoDate).toDate(),
            uploadDate: dateNow,
            labels: metadata.labels,
        });
    });

    test("upload asset original", async () => {

        const { baseUrl, mockCollection, mockStorage } = await initServer();

        mockCollection.updateOne = jest.fn();
        mockStorage.write = jest.fn();

        const assetId = "63de0ba152be7661d4926bf1";

        const response = await axios.post(
            `${baseUrl}/asset`, 
            fs.readFileSync("./test/test-assets/1.jpeg"),
            {
                headers: { 
                    'id': assetId,
                    'Content-Type': 'image/jpeg' 
                },
            }
        );

        expect(response.status).toBe(200);

        expect(mockStorage.write).toHaveBeenCalledTimes(1);
        expect(mockStorage.write.mock.calls[0][0]).toEqual("original");
        expect(mockStorage.write.mock.calls[0][1]).toEqual(assetId);

        expect(mockCollection.updateOne).toHaveBeenCalledTimes(1);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            {
                _id: new ObjectId(assetId),
            },
            {
                $set: {
                    assetContentType: "image/jpeg",
                },
            }
        );
    });

    test("upload thumbnail", async () => {

        const { baseUrl, mockCollection, mockStorage } = await initServer();

        mockCollection.updateOne = jest.fn();
        mockStorage.write = jest.fn();

        const assetId = "63de0ba152be7661d4926bf1";

        const response = await axios.post(
            `${baseUrl}/thumb`, 
            fs.readFileSync("./test/test-assets/1.jpeg"), {
                headers: { 
                    'id': assetId, 
                    'Content-Type': 'image/jpeg' 
                },
            }
        );

        expect(response.status).toBe(200);

        expect(mockCollection.updateOne).toHaveBeenCalledTimes(1);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            {
                _id: new ObjectId(assetId),
            },
            {
                $set: {
                    thumbContentType: "image/jpeg",
                },
            }
        );

        expect(mockStorage.write).toHaveBeenCalledTimes(1);
        expect(mockStorage.write.mock.calls[0][0]).toEqual("thumb");
        expect(mockStorage.write.mock.calls[0][1]).toEqual(assetId);
    });

    //
    // Uploads an asset with one of the required headers missing.
    //
    async function uploadAssetWithMissingMetadata(metadata: any, missingField: string) {

        const { baseUrl, mockCollection } = await initServer();

        mockCollection.insertOne = jest.fn();

        const augumented = Object.assign({}, metadata);
        delete augumented[missingField];

        const response = await axios.post(`${baseUrl}/metadata`, augumented);
    
        expect(response.status).toBe(500);
    }
    
    test("upload asset with missing headers", async () => {

        const metadata = {
            fileName: "a-test-file.jpg",
            width: 256,
            height: 1024,
            hash: "1234",
            fileDate: "2023-02-08T01:24:02.947Z",
        };

        await uploadAssetWithMissingMetadata(metadata, "fileName");
        await uploadAssetWithMissingMetadata(metadata, "width");
        await uploadAssetWithMissingMetadata(metadata, "height");
        await uploadAssetWithMissingMetadata(metadata, "hash");
        await uploadAssetWithMissingMetadata(metadata, "fileDate");
    });

    //
    // Uploads an asset with the specified headers.
    //
    async function uploadAsset(headers: { [index: string]: string; }) {

        const { baseUrl, mockCollection } = await initServer();

        mockCollection.insertOne = () => {};

        return await axios.post("/asset", fs.readFileSync("./test/test-assets/1.jpeg"), {
            baseURL: baseUrl,
            headers,
        });
    }
    
    test("upload asset with bad width", async () => {

        const headers = {
            "file-name": "a-test-file.jpg",
            "content-type": "image/jpg",
            "width": "---",
            "height": "1024",
            "hash": "1234",
        };

        const response = await uploadAsset(headers);
        expect(response.status).toBe(500);
    });

    test("upload asset with bad height", async () => {

        const headers = {
            "file-name": "a-test-file.jpg",
            "content-type": "image/jpg",
            "width": "256",
            "height": "---",
            "hash": "1234",
        };

        const response = await uploadAsset(headers);
        expect(response.status).toBe(500);
    });

    test("get existing asset", async () => {

        const assetId = new ObjectId();
        const { baseUrl, mockCollection, mockStorage } = await initServer();
        const content = "ABCD";
        const contentType = "image/jpeg";

        const mockAsset: any = {
            assetContentType: contentType,
        };
        mockCollection.findOne = (query: any) => {
            expect(query._id).toEqual(assetId);
            
            return mockAsset;
        };

        mockStorage.read = jest.fn((type: string, assetId: string) => {
            expect(type).toBe("original");
            expect(assetId).toBe(assetId);
            return stringStream(content);
        });

        const response = await axios.get(`${baseUrl}/asset?id=${assetId}`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe(contentType);
        expect(response.data).toEqual(content);
    });

    test("non existing asset yields a 404 error", async () => {

        const assetId = new ObjectId();
        const { baseUrl, mockCollection } = await initServer();

        mockCollection.findOne = (query: any) => {
            return undefined;
        };

        const response = await axios.get(`${baseUrl}/asset?id=${assetId}`);
        expect(response.status).toBe(404);
    });

    test("get existing asset with no id yields an error", async () => {

        const { baseUrl } = await initServer();

        const response = await axios.get(`${baseUrl}/asset`);
        expect(response.status).toBe(500);
    });

    test("get existing thumb", async () => {

        const assetId = new ObjectId();
        const content = "ABCD";
        const contentType = "image/jpeg";

        const { baseUrl, mockCollection, mockStorage } = await initServer();

        const mockAsset: any = {
            thumbContentType: contentType,
        };
        mockCollection.findOne = (query: any) => {
            expect(query._id).toEqual(assetId);
            return mockAsset;
        };
        mockStorage.read = jest.fn((type: string, assetId: string) => {
            expect(type).toBe("thumb");
            expect(assetId).toBe(assetId);
            return stringStream(content);
        });

        const response = await axios.get(`${baseUrl}/thumb?id=${assetId}`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe(contentType);
        expect(response.data).toEqual(content);
    });

    test("get thumb returns original asset when thumb doesn't exist", async () => {

        const assetId = new ObjectId();
        const content = "ABCD";
        const contentType = "image/jpeg";

        const { baseUrl, mockCollection, mockStorage } = await initServer();

        const mockAsset: any = {
            assetContentType: contentType,
        };
        mockCollection.findOne = (query: any) => {
            expect(query._id).toEqual(assetId);
            
            return mockAsset;
        };
        mockStorage.read = jest.fn((type: string, assetId: string) => {
            expect(type).toBe("original");
            expect(assetId).toBe(assetId);
            return stringStream(content);
        });

        const response = await axios.get(`${baseUrl}/thumb?id=${assetId}`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe(contentType);
        expect(response.data).toEqual(content);
    });

    test("non existing thumb yields a 404 error", async () => {

        const assetId = new ObjectId();
        const { baseUrl, mockCollection } = await initServer();

        mockCollection.findOne = (query: any) => {
            return undefined;
        };

        const response = await axios.get(`${baseUrl}/thumb?id=${assetId}`);
        expect(response.status).toBe(404);
    });

    test("get existing thumb with no id yields an error", async () => {

        const { baseUrl } = await initServer();

        const response = await axios.get(`${baseUrl}/thumb`);
        expect(response.status).toBe(500);
    });

    test("get existing display asset", async () => {

        const assetId = new ObjectId();
        const content = "ABCD";
        const contentType = "image/jpeg";

        const { baseUrl, mockCollection, mockStorage } = await initServer();

        const mockAsset: any = {
            displayContentType: contentType,
        };
        mockCollection.findOne = (query: any) => {
            expect(query._id).toEqual(assetId);
            return mockAsset;
        };
        mockStorage.read = jest.fn((type: string, assetId: string) => {
            expect(type).toBe("display");
            expect(assetId).toBe(assetId);
            return stringStream(content);
        });

        const response = await axios.get(`${baseUrl}/display?id=${assetId}`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe(contentType);
        expect(response.data).toEqual(content);
    });

    test("get display asset returns original asset when display asset doesn't exist", async () => {

        const assetId = new ObjectId();
        const content = "ABCD";
        const contentType = "image/jpeg";

        const { baseUrl, mockCollection, mockStorage } = await initServer();

        const mockAsset: any = {
            assetContentType: contentType,
        };
        mockCollection.findOne = (query: any) => {
            expect(query._id).toEqual(assetId);
            
            return mockAsset;
        };
        mockStorage.read = jest.fn((type: string, assetId: string) => {
            expect(type).toBe("original");
            expect(assetId).toBe(assetId);
            return stringStream(content);
        });

        const response = await axios.get(`${baseUrl}/display?id=${assetId}`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toBe(contentType);
        expect(response.data).toEqual(content);
    });

    test("non existing display asset yields a 404 error", async () => {

        const assetId = new ObjectId();
        const { baseUrl, mockCollection } = await initServer();

        mockCollection.findOne = (query: any) => {
            return undefined;
        };

        const response = await axios.get(`${baseUrl}/display?id=${assetId}`);
        expect(response.status).toBe(404);
    });

    test("get existing display asset with no id yields an error", async () => {

        const { baseUrl } = await initServer();

        const response = await axios.get(`${baseUrl}/display`);
        expect(response.status).toBe(500);
    });

    test("check for existing asset by hash", async () => {

        const hash = "1234";
        const { baseUrl, mockCollection } = await initServer();

        const mockAsset: any = {
            _id: "ABCD",
        };
        mockCollection.findOne = (query: any) => {
            expect(query.hash).toEqual(hash);
            
            return mockAsset;
        };

        const response = await axios.get(`${baseUrl}/check-asset?hash=${hash}`);
        expect(response.status).toBe(200);
        expect(response.data.assetId).toEqual("ABCD");
    });

    test("check for non-existing asset by hash", async () => {

        const hash = "1234";
        const { baseUrl, mockCollection } = await initServer();

        mockCollection.findOne = (query: any) => {
            return undefined;
        };

        const response = await axios.get(`${baseUrl}/check-asset?hash=${hash}`);
        expect(response.status).toBe(200);
        expect(response.data.assetId).toBeUndefined();
    });

    test("check for existing asset with no hash yields an error", async () => {

        const { baseUrl } = await initServer();

        const response = await axios.get(`${baseUrl}/check-asset`);
        expect(response.status).toBe(500);
    });

    test("can get assets", async () => {

        const { baseUrl, mockCollection } = await initServer();

        const mockAsset1: any = {
            contentType: "image/jpeg",
        };
        const mockAsset2: any = { 
            contentType: "image/png",
        };

        mockCollection.find = (query: any) => {
            expect(query).toEqual({}); // Expect no search query.

            return {
                sort() {
                    return {
                        toArray() {
                            return [ mockAsset1, mockAsset2 ];
                        }
                    };
                }
            };
        };

        const response = await axios.get(`${baseUrl}/assets`);
        
        expect(response.status).toBe(200);
        expect(response.data).toEqual({
            assets: [ mockAsset1, mockAsset2 ],
        });
    });

    test("can add label to asset", async () => {

        const { baseUrl, mockCollection } = await initServer();

        mockCollection.updateOne = jest.fn();

        const id = new ObjectId();
        const label = "A good label";

        const response = await axios.post(
            `${baseUrl}/asset/add-label`, 
            {
                id: id,
                label: label,
            }, 
            { 
                headers: { 
                    'Content-Type': 'application/json' //todo ???
                },
            },
        );

        expect(response.status).toBe(200);
        
        expect(mockCollection.updateOne).toBeCalledTimes(1);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: id },
            { 
                $push: {
                    labels: label,
                },
            }
        );
    });

    test("can remove label from asset", async () => {

        const { baseUrl, mockCollection } = await initServer();

        mockCollection.updateOne = jest.fn();

        const id = new ObjectId();
        const label = "A good label";

        const response = await axios.post(
            `${baseUrl}/asset/remove-label`,
            {
                id: id,
                label: label,
            },
            { 
                headers: { 
                    'Content-Type': 'application/json' //todo ???
                },
            },
        );

        expect(response.status).toBe(200);
        
        expect(mockCollection.updateOne).toBeCalledTimes(1);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: id },
            { 
                $pull: {
                    labels: label,
                },
            }
        );
    });

    test("can set description for asset", async () => {

        const { baseUrl, mockCollection } = await initServer();

        mockCollection.updateOne = jest.fn();

        const id = new ObjectId();
        const description = "A good description";

        const response = await axios.post(
            `${baseUrl}/asset/description`,
            {
                id: id,
                description: description,
            },
            { 
                headers: { 
                    'Content-Type': 'application/json' //todo ???
                },
            },
        );

        expect(response.status).toBe(200);
        
        expect(mockCollection.updateOne).toBeCalledTimes(1);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: id },
            { 
                $set: {
                    description: description,
                },
            }
        );
    });

    test("can search assets", async () => {

        const { baseUrl, mockCollection } = await initServer();

        const mockAsset: any = {
            contentType: "image/jpeg",
        };

        mockCollection.find = (query: any) => {
            expect(query).toEqual({ 
                $text: { 
                    $search: 'something' 
                },
            });
            
            return {
                sort() {
                    return {
                        toArray() {
                            return [ mockAsset ];
                        },
                    };
                }
            };
        };

        const searchText = "something";
        const response = await axios.get(`${baseUrl}/assets?search=${searchText}`);
        
        expect(response.status).toBe(200);
        expect(response.data).toEqual({
            assets: [ mockAsset ],
        });
    });

});

