
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Render } from '../render';
import { Application, Container, Graphics } from 'pixi.js';
import * as ViewportLayerModule from '../viewport-layer';
import * as SelectionLayerModule from '../selection-layer';
import * as RenderSelectionStore from '../stores/selection';
import { DataTypes, MouseData, RenderContainerData, RenderElementData, SceneElement } from '../types';

// Mock pixi.js Application FIRST
vi.mock('pixi.js', () => {
  const mockAppInstance = {
    init: vi.fn(() => Promise.resolve()),
    stage: {
      addChild: vi.fn(),
      eventMode: '',
    },
  };
  return {
    Application: vi.fn(() => mockAppInstance),
    Container: vi.fn(), // Make sure Container is mocked and available
    Graphics: vi.fn(),
  };
});

// THEN Mock ViewportLayer
vi.mock('../viewport-layer', () => {
  // Container is now available from the pixi.js mock
  const mockViewportLayerInstance = {
    view: new Container(), // Use the mocked Container
    switchWorkspace: vi.fn(),
    addContainer: vi.fn(),
    addElement: vi.fn(),
    removeElement: vi.fn(),
    updateElement: vi.fn(),
    updateElementProperties: vi.fn(),
    zoomFit: vi.fn(),
    panTo: vi.fn(),
    zoomTo: vi.fn(),
    zoomToCenter: vi.fn(),
    getPosition: vi.fn(),
    getScale: vi.fn(),
    getMousePosInWorkspace: vi.fn(),
    getElementById: vi.fn(),
  };
  return {
    ViewportLayer: vi.fn(() => mockViewportLayerInstance),
    default: mockViewportLayerInstance,
  };
});

// THEN Mock SelectionLayer
vi.mock('../selection-layer', () => {
  // Container is now available from the pixi.js mock
  const mockSelectionLayerInstance = {
    view: new Container(), // Use the mocked Container
  };
  return {
    SelectionLayer: vi.fn(() => mockSelectionLayerInstance),
    default: mockSelectionLayerInstance,
  };
});

// Mock renderSelection store
vi.mock('../stores/selection', () => ({
  default: {
    elementSelection: new Set(),
  },
}));

describe('Render', () => {
  let render: Render;
  let mockApp: vi.Mocked<Application>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Reset mock instances for each test
    vi.mocked(Application).mockClear();
    vi.mocked(ViewportLayerModule.ViewportLayer).mockClear();
    vi.mocked(SelectionLayerModule.SelectionLayer).mockClear();

    // Ensure mockApp is the instance returned by Application constructor
    mockApp = new Application() as vi.Mocked<Application>;
    vi.mocked(Application).mockImplementation(() => mockApp);

    render = new Render();
  });

  // Test constructor
  it('should instantiate ViewportLayer and SelectionLayer', () => {
    expect(ViewportLayerModule.ViewportLayer).toHaveBeenCalledTimes(1);
    expect(SelectionLayerModule.SelectionLayer).toHaveBeenCalledTimes(1);
    expect(render.viewport).toBeInstanceOf(ViewportLayerModule.ViewportLayer);
    expect(render.selection).toBeInstanceOf(SelectionLayerModule.SelectionLayer);
  });

  // Test init method
  it('should initialize Pixi.js application and set up stage layers', async () => {
    const width = 800;
    const height = 600;
    const backgroundColor = 0xffffff;

    await render.init(width, height, backgroundColor);

    expect(Application).toHaveBeenCalledTimes(1);
    expect(mockApp.init).toHaveBeenCalledWith({
      width,
      height,
      backgroundColor,
      resolution: Math.min(window.devicePixelRatio, 2),
      resizeTo: window,
      antialias: true,
      autoDensity: true,
    });
    expect(render.app).toBe(mockApp);
    expect(mockApp.stage.addChild).toHaveBeenCalledTimes(2);
    expect(mockApp.stage.addChild).toHaveBeenCalledWith(mockViewportLayerInstance.view);
    expect(mockApp.stage.addChild).toHaveBeenCalledWith(mockSelectionLayerInstance.view);
  });

  // Test getSelectedElements
  it('should get selected elements from renderSelection and viewport', () => {
    const mockElementIds = ['el1', 'el2'];
    const mockSceneElements = [
      { id: 'el1', type: 'RECTANGLE' },
      { id: 'el2', type: 'CIRCLE' },
    ];
    vi.mocked(RenderSelectionStore.default.elementSelection).add('el1');
    vi.mocked(RenderSelectionStore.default.elementSelection).add('el2');
    vi.mocked(mockViewportLayerInstance.getElementById).mockImplementation((id) => {
      return mockSceneElements.find((el) => el.id === id) as SceneElement;
    });

    const result = render.getSelectedElements();

    expect(mockViewportLayerInstance.getElementById).toHaveBeenCalledTimes(2);
    expect(mockViewportLayerInstance.getElementById).toHaveBeenCalledWith('el1');
    expect(mockViewportLayerInstance.getElementById).toHaveBeenCalledWith('el2');
    expect(result).toEqual(mockSceneElements);
  });

  // Test delegation methods to viewport
  it('should delegate switchWorkspace to viewport', () => {
    const data = { id: 'ws1', type: 'WORKSPACE' } as RenderContainerData;
    render.switchWorkspace(data);
    expect(mockViewportLayerInstance.switchWorkspace).toHaveBeenCalledWith(data);
  });

  it('should delegate addContainer to viewport', () => {
    const data = { id: 'cont1', type: 'CONTAINER' } as RenderContainerData;
    render.addContainer(data);
    expect(mockViewportLayerInstance.addContainer).toHaveBeenCalledWith(data);
  });

  it('should delegate addElement to viewport', () => {
    const data = { id: 'el1', type: 'RECTANGLE' } as RenderElementData;
    render.addElement(data);
    expect(mockViewportLayerInstance.addElement).toHaveBeenCalledWith(data);
  });

  it('should delegate removeElement to viewport', () => {
    render.removeElement('el1', 'parent1');
    expect(mockViewportLayerInstance.removeElement).toHaveBeenCalledWith('el1', 'parent1');
  });

  it('should delegate updateElement to viewport', () => {
    const before = { x: 0 };
    const after = { x: 10 };
    render.updateElement('el1', 'x', before, after);
    expect(mockViewportLayerInstance.updateElement).toHaveBeenCalledWith('el1', 'x', before, after);
  });

  it('should delegate updateElementProperties to viewport', () => {
    const element = new Container();
    const after = { x: 10 };
    render.updateElementProperties(element, 'x', after);
    expect(mockViewportLayerInstance.updateElementProperties).toHaveBeenCalledWith(element, 'x', after);
  });

  it('should delegate zoomFit to viewport', () => {
    const uiBounds = new DOMRect(0, 0, 100, 100);
    render.zoomFit(uiBounds);
    expect(mockViewportLayerInstance.zoomFit).toHaveBeenCalledWith(uiBounds);
  });

  it('should delegate panTo to viewport', () => {
    render.panTo(10, 20);
    expect(mockViewportLayerInstance.panTo).toHaveBeenCalledWith(10, 20);
  });

  it('should delegate zoomTo to viewport', () => {
    render.zoomTo(1.5);
    expect(mockViewportLayerInstance.zoomTo).toHaveBeenCalledWith(1.5);
  });

  it('should delegate zoomToCenter to viewport', () => {
    render.zoomToCenter(1.5, 10, 20);
    expect(mockViewportLayerInstance.zoomToCenter).toHaveBeenCalledWith(1.5, 10, 20);
  });

  it('should delegate getViewportPosition to viewport', () => {
    render.getViewportPosition();
    expect(mockViewportLayerInstance.getPosition).toHaveBeenCalledTimes(1);
  });

  it('should delegate getViewportScale to viewport', () => {
    render.getViewportScale();
    expect(mockViewportLayerInstance.getScale).toHaveBeenCalledTimes(1);
  });

  it('should delegate getMousePosInWorkspace to viewport', () => {
    const mouseData = { x: 10, y: 20 } as MouseData;
    render.getMousePosInWorkspace(mouseData);
    expect(mockViewportLayerInstance.getMousePosInWorkspace).toHaveBeenCalledWith(mouseData);
  });
});
