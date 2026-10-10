declare module '@reedito/kg-default-nodes' {
  import { ElementNode, TextNode } from 'lexical';

  export class AtLinkNode extends ElementNode {}
  export class AtLinkSearchNode extends TextNode {}
  export class ZWNJNode extends TextNode {}
}
