import * as EXIF from './exif-js/exif';

//
// Loads URL or source data to an image element.
//
export function loadImage(imageSrc: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve(img);
        };
        img.src = imageSrc;
    });
}

//
// Loads a blob to a data URL.
//
export function loadBlobToDataURL(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

//
// Loads a blob to an image element.
//
export async function loadBlobToImage(blob: Blob): Promise<HTMLImageElement> {
    const dataURL = await loadBlobToDataURL(blob);
    return await loadImage(dataURL);
}

//
// Represents the resolution of the image or video.
//
export interface IResolution {
    //
    // The width of the image or video.
    //
    width: number;

    //
    // The height of the image or video.
    //
    height: number;
}

//
// Gets the size of an image element.
//
export function getImageResolution(image: HTMLImageElement): IResolution {
    return {
        width: image.width,
        height: image.height,
    };
}

//
// Resizes an image.
//
// https://stackoverflow.com/a/43354901/25868
//
export function resizeImage(image: HTMLImageElement, minSize: number): string {
    const oc = document.createElement('canvas'); // As long as we don't reference this it will be garbage collected.
    const octx = oc.getContext('2d')!;
    oc.width = image.width;
    oc.height = image.height;
    octx.drawImage(image, 0, 0);

    // Commented out code could be useful.
    if( image.width > image.height) {
        oc.height = minSize;
        oc.width = (image.width / image.height) * minSize;
    } 
    else {
        oc.height = (image.height / image.width) * minSize;
        oc.width = minSize;
    }

    octx.drawImage(oc, 0, 0, oc.width, oc.height);
    octx.drawImage(image, 0, 0, oc.width, oc.height);
    return oc.toDataURL();
}

//
// Retreives exif data from the file.
//
// https://github.com/exif-js/exif-js
//
export function getExifData(file: File | Blob): Promise<any> {
    return new Promise((resolve, reject) => {
        EXIF.getData(file as any, function () { // ! Don't change this to an arrow function. It might break the way this works.
            // @ts-ignore. This next line is necessary, but it causes a TypeScript error.
            resolve(EXIF.getAllTags(this));
        });
    });
}
