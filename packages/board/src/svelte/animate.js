import { cubicOut } from 'svelte/easing';
import { is_function } from 'svelte/internal';

import { enabled } from './global';

function flip(node, animation, params) {
    const style = getComputedStyle(node);
    const transform = style.transform === 'none' ? '' : style.transform;
    const dx = animation.from.left - animation.to.left;
    const dy = animation.from.top - animation.to.top;
    const d = Math.sqrt(dx * dx + dy * dy);
    const { delay = 0, duration = d => Math.sqrt(d) * 120, easing = cubicOut } = params;
    return {
        delay,
        duration: enabled ? (is_function(duration) ? duration(d) : duration) : 0,
        easing,
        css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
    };
}

export { flip };