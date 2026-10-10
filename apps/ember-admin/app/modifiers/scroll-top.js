import getScrollParent from 'reedito-admin/utils/get-scroll-parent';
import {modifier} from 'ember-modifier';

export default modifier((element) => {
    getScrollParent(element).scrollTop = 0;
}, {eager: false});
