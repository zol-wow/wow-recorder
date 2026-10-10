import EditorService from 'main/EditorService';
import type { IRecorderBackend } from 'main/platform/recorder/IRecorderBackend';

/**
 * An overlay of 400x300 px, cropped 100 px left and right and 50 px top
 * and bottom, at half scale. Visible on the canvas as 100x100 at (0, 0).
 */
const setup = () => {
  const pos = {
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    scaleX: 0.5,
    scaleY: 0.5,
    cropLeft: 100,
    cropRight: 100,
    cropTop: 50,
    cropBottom: 50,
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
  editor.reset();
  editor.setBackend(backend);
  const commit = jest.fn();
  editor.onCommit(commit);

  const left = { button: 0, buttons: 1 };
  const at = (x: number, y: number, ev = left) =>
    ({ ...ev, offsetX: x, offsetY: y }) as never;

  return { editor, commit, pos, at };
};

describe('mac scene editor', () => {
  it('commits the position, scale and crop of a moved source', () => {
    const { editor, commit, at } = setup();

    editor.handleMouseDown(at(50, 50));
    editor.handleMouseMove(at(150, 90));
    editor.handleMouseUp();

    expect(commit).toHaveBeenLastCalledWith({
      name: 'WCR Chat Overlay',
      x: 100,
      y: 40,
      scale: 0.5,
      cropLeft: 100,
      cropTop: 50,
    });
  });

  it('ignores clicks on the cropped away part of a source', () => {
    const { editor, commit, at } = setup();

    editor.handleMouseDown(at(150, 50));
    editor.handleMouseMove(at(250, 90));
    editor.handleMouseUp();

    expect(commit).not.toHaveBeenCalled();
  });

  it('ignores the right mouse button', () => {
    const { editor, commit, at } = setup();
    const right = { button: 2, buttons: 2 };

    editor.handleMouseDown(at(50, 50, right));
    editor.handleMouseMove(at(150, 90, right));
    editor.handleMouseUp();

    expect(commit).not.toHaveBeenCalled();
  });

  it('resizes from the visible corner', () => {
    const { editor, commit, at } = setup();

    editor.handleMouseDown(at(50, 50)); // Select it.
    editor.handleMouseUp();
    editor.handleMouseDown(at(100, 100)); // Bottom right of what's visible.
    editor.handleMouseMove(at(200, 200));
    editor.handleMouseUp();

    // 200 px wide from the top left anchor, of 200 px visible source.
    expect(commit).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 0, y: 0, scale: 1 }),
    );
  });
});
