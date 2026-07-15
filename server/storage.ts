import { Readable } from "node:stream";

import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

import { config } from "./config.js";

const endpoint = new URL(config.minioEndpoint);

export const storage = new S3Client({
    endpoint: endpoint.toString(),
    region: config.minioRegion,
    forcePathStyle: true,
    credentials: { accessKeyId: config.minioAccessKey, secretAccessKey: config.minioSecretKey },
});

export async function ensureMediaBucket() {
    try {
        await storage.send(new HeadBucketCommand({ Bucket: config.minioBucket }));
    } catch {
        await storage.send(new CreateBucketCommand({ Bucket: config.minioBucket }));
    }
}

export async function putMedia(objectKey: string, body: Buffer, contentType: string) {
    await storage.send(
        new PutObjectCommand({
            Bucket: config.minioBucket,
            Key: objectKey,
            Body: body,
            ContentType: contentType,
            CacheControl: "private, max-age=31536000, immutable",
        }),
    );
}

export async function getMedia(objectKey: string) {
    const object = await storage.send(new GetObjectCommand({ Bucket: config.minioBucket, Key: objectKey }));
    const body = object.Body ? Readable.fromWeb(object.Body.transformToWebStream() as never) : null;
    return { body, contentType: object.ContentType, contentLength: object.ContentLength };
}

export async function deleteMedia(objectKey: string) {
    await storage.send(new DeleteObjectCommand({ Bucket: config.minioBucket, Key: objectKey }));
}
