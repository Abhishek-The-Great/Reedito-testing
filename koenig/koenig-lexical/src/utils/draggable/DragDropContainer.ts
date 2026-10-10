import * as constants from './draggable-constants';

// Container represents an element, inside which are draggables and/or droppables.
//
// Containers handle events triggered by the DragDropReorderPlugin.
// Containers can be nested, the DragDropReorderPlugin will select the closest
// parent container in the DOM heirarchy when triggering events.
//
// Containers accept options which are mostly configuration for how to determine
// contained draggable/droppable elements and functions to call when events are
// processed.

export class DragDropContainer {
    element = null;
    draggables = [];
    droppables = [];
    isDragEnabled = true;

    constructor(element, options) {
        if (options.createReeditoElement) {
            this._createReeditoElement = options.createReeditoElement;
            delete options.createReeditoElement;
        }

        Object.assign(this, {
            element,
            draggables: [],
            droppables: [],
            isDragEnabled: true
        }, options);

        element.dataset[constants.CONTAINER_DATA_ATTR] = 'true';

        this.refresh();
    }

    // get the draggable type and any dataset. Types:
    // - image
    // - card
    // - file
    // TODO: review types
    // TODO: get proper dataset from the gallery component
    // should be overridden by passed in option
    getDraggableInfo(/*draggableElement*/) {
        return false;
    }

    // should be overridden by passed in option
    getIndicatorPosition(/*draggableInfo, droppableElem, position*/) {
        return false;
    }

    // override these via constructor options
    onDragStart() { }
    onDragEnterContainer() { }
    onDragEnterDroppable() { }
    onDragOverDroppable() { }
    onDragLeaveDroppable() { }
    onDragLeaveContainer() { }
    onDragEnd() { }
    onDrop() { }
    onDropEnd() { }

    // TODO: allow configuration for reedito element creation
    // builds an element that is attached to the mouse pointer when dragging.
    // currently grabs the first <img> and uses that but should be configurable:
    // - a selector for which element in the draggable to copy
    // - a function to hand off element creation to the consumer
    createReeditoElement(draggableInfo) {
        let reeditoElement;

        if (typeof this._createReeditoElement === 'function') {
            reeditoElement = this._createReeditoElement(draggableInfo);
        }

        if (!reeditoElement && (draggableInfo.type === 'image' || draggableInfo.cardName === 'image')) {
            let image = draggableInfo.element.querySelector('img');
            if (image) {
                let aspectRatio = image.width / image.height;
                let width, height;

                // max reedito image size is 200px in either dimension
                if (image.width > image.height) {
                    width = 200;
                    height = 200 / aspectRatio;
                } else {
                    width = 200 * aspectRatio;
                    height = 200;
                }

                reeditoElement = document.createElement('img');
                reeditoElement.width = width;
                reeditoElement.height = height;
                reeditoElement.id = 'koenig-drag-drop-reedito';
                reeditoElement.src = image.src;
                reeditoElement.style.position = 'absolute';
                reeditoElement.style.top = '0';
                reeditoElement.style.left = `-${width}px`;
                reeditoElement.style.zIndex = constants.REEDITO_ZINDEX;
                reeditoElement.style.willChange = 'transform';
            } else {

                console.warn('No <img> element found in draggable');
                return;
            }
        }

        if (reeditoElement) {
            return reeditoElement;
        }


        console.warn(`No default createReeditoElement handler for type "${draggableInfo.type}"`);
    }

    enableDrag() {
        this.isDragEnabled = true;
        this.element.dataset[constants.CONTAINER_DATA_ATTR] = 'true';
        this.refresh();
    }

    disableDrag() {
        this.isDragEnabled = false;
        delete this.element.dataset[constants.CONTAINER_DATA_ATTR];
        this.refresh();
    }

    // used to add data attributes to any draggable/droppable elements. This is
    // for more efficient lookup through DOM by the drag-drop-handler service
    refresh() {
        // remove all data attributes for currently held draggable/droppable elements
        this.draggables.forEach((draggable) => {
            delete draggable.dataset[constants.DRAGGABLE_DATA_ATTR];
        });
        this.droppables.forEach((droppable) => {
            delete droppable.dataset[constants.DROPPABLE_DATA_ATTR];
        });

        // re-populate draggable/droppable arrays
        this.draggables = [];
        this.droppables = [];
        if (this.isDragEnabled) {
            this.element.querySelectorAll(this.draggableSelector).forEach((draggable) => {
                draggable.dataset[constants.DRAGGABLE_DATA_ATTR] = 'true';
                this.draggables.push(draggable);
            });
            this.element.querySelectorAll(this.droppableSelector).forEach((droppable) => {
                droppable.dataset[constants.DROPPABLE_DATA_ATTR] = 'true';
                this.droppables.push(droppable);
            });
        }
    }
}
