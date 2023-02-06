
//
// Details of an asset to be uploaded.
//

import { IResolution } from "./image";

//
// The state of an individual upload.
//
export type UploadState = "already-uploaded" | "pending" | "uploading" | "uploaded";


export interface IUploadDetails {
    //
    // The original file to upload.
    //
    file: File;
    
    //
    // The resolution of the asset.
    //
    resolution: IResolution;

    //
    // Full data URL for the thumbnail, so it can be displayed in the browser during the upload.
    //
    thumbnailDataUrl: string;
    
    //
    // Base64 encoded thumbnail for the asset.
    //
    thumbnail: string;
    
    // 
    // The content type of the thumbnail.
    //
    thumbContentType: string;

    //
    // Hash of the data.
    //
    hash: string;

    //
    // Optional properties, like exif data.
    //
    properties?: any;

    //
    // Reverse geocoded location of the asset, if known.
    //
    location?: string;

    //
    //  Records the status of the upload item.
    //
    status: UploadState;

    //
    // Id assigned to the asset after it is uploaded.
    //
    assetId?: string;
}