import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const S3 = new S3Client();
const DEST_BUCKET = process.env.DEST_BUCKET;
const SMALL_WIDTH = 48; // px
const THUMBNAIL_WIDTH = 120; // px
const SUPPORTED_FORMATS = {
  jpg: true,
  jpeg: true,
  png: true,
  webp:true
};
export const handler = async (event, context) => {
  try {
    const { eventTime, s3 } = event.Records[0];
    const srcBucket = s3.bucket.name;

    // Object key may have spaces or unicode non-ASCII characters
    const srcKey = decodeURIComponent(s3.object.key.replace(/\+/g, " "));
    const ext = srcKey.replace(/^.*\./, "").toLowerCase();

    console.log(`${eventTime} - ${srcBucket}/${srcKey}`);

    if (!SUPPORTED_FORMATS[ext]) {
      console.log(`ERROR: Unsupported file type (${ext})`);
      return;
    }

    // Get the image from the source bucket

    const { Body, ContentType } = await S3.send(
      new GetObjectCommand({
        Bucket: srcBucket,
        Key: srcKey,
      })
    );

    const image = await Body.transformToByteArray();

    const thumbnailBuffer = await sharp(image)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH)
      .toBuffer();
    const smallBuffer = await sharp(image)
      .resize(SMALL_WIDTH, SMALL_WIDTH)
      .toBuffer();

    // store new image in the destination bucket
    const mode = srcKey.split("/")[0];
    const accountId = srcKey.split("/")[1];
    const Image = srcKey.split("/")[2];
    await S3.send(
      new PutObjectCommand({
        Bucket: DEST_BUCKET,
        Key: `${mode}/${accountId}/thumbnail/${Image}`,
        Body: thumbnailBuffer,
        ContentType,
      })
    );
    await S3.send(
      new PutObjectCommand({
        Bucket: DEST_BUCKET,
        Key: `${mode}/${accountId}/small/${Image}`,
        Body: smallBuffer,
        ContentType,
      })
    );
    const message = `Successfully resized ${srcBucket}/${srcKey} and uploaded to ${DEST_BUCKET}/${srcKey}`;
    console.log(message);
    return {
      statusCode: 200,
      body: message,
    };
  } catch (error) {
    console.log(error.message);
  }
};