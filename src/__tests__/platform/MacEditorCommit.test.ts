import EditorService from 'main/EditorService';
import type { IRecorderBackend } from 'main/platform/recorder/IRecorderBackend';

describe('mac scene editor commit', () => {
  it('commits the position, scale and crop of the dragged source', () => {
    const pos = {
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      scaleX: 0.5,
      scaleY: 0.5,
      cropLeft: 12,
      cropRight: 12,
      cropTop: 8,
      cropBottom: 8,
    };

    const backend = {
      getPreviewInfo: () => ({
        canvasWidth: 1920,
        canvasHeight: 1080,
        previewWidth: 1920,
        previewHeight: 1080,
      }),
      listSceneItems: () => ['WCR Chat Overlay'],
      getSourcePos: () => pos,
      setSourcePos: (_: string, p: Partial<typeof pos>) => {
        Object.assign(pos, p);
      },
    } as unknown as IRecorderBackend;

    const editor = EditorService.getInstance();
    editor.setBackend(backend);
    const commit = jest.fn();
    editor.onCommit(commit);

    const ev = { button: 0, buttons: 1 };
    editor.handleMouseDown({ ...ev, offsetX: 50, offsetY: 50 } as never);
    editor.handleMouseMove({ ...ev, offsetX: 150, offsetY: 90 } as never);
    editor.handleMouseUp();

    expect(commit).toHaveBeenCalledWith({
      name: 'WCR Chat Overlay',
      x: 100,
      y: 40,
      scale: 0.5,
      cropLeft: 12,
      cropTop: 8,
    });
  });
});
