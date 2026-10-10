import type {ExportDOMOptions} from '@reedito/kg-default-nodes';

export interface RendererOptions extends ExportDOMOptions {
    usedIdAttributes?: Record<string, number>;
    renderData?: Map<number, unknown>;
}
