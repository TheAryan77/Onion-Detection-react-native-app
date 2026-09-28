// Native: photos come from the camera and gallery buttons, so there is no drop target.
// The web build uses DropZone.web.tsx instead.
export function DropZone(_props: { onFile: (uri: string) => void }) {
  return null;
}
