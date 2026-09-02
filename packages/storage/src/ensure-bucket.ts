import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Idempotent: HeadBucket to check, CreateBucket only if missing. Called once
 * at process startup, never per-request
 * (34_Development_Setup_and_Fourth_Sprint.md §18).
 */
export async function ensureBucket(client: S3Client, bucketName: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return;
  } catch {
    // Any HeadBucket failure (404 Not Found, or a MinIO-specific variant of
    // "doesn't exist") falls through to a create attempt below.
  }
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
  } catch (error) {
    // A second process racing to create the same bucket concurrently is not
    // a real failure — re-check existence before giving up.
    const stillMissing = await client
      .send(new HeadBucketCommand({ Bucket: bucketName }))
      .then(() => false)
      .catch(() => true);
    if (stillMissing) throw error;
  }
}
