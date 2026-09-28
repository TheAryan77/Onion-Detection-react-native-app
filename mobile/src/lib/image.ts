import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Shrink the photo before upload: faster on mobile data, and the server works at 1280 px anyway.
 *  SDK 57 deprecates manipulateAsync, so this uses the contextual manipulate() API instead. */
export async function prepareForUpload(uri: string): Promise<string> {
  try {
    const image = await ImageManipulator.manipulate(uri).resize({ width: 1280 }).renderAsync();
    const out = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri; // The server resizes anyway; never block grading on a client-side resize
  }
}
