/**
 * Call these functions to wrap a string in ANSI color codes. Add `.bold`, `.dim`, `.underline`, `.blink`, or `.inverse` to the function to add the corresponding ANSI codes. String as many effects together as you like. (Note that not all terminals support all effects.)
 */
export declare const Colors: {
    black: ColorFn;
    red: ColorFn;
    green: ColorFn;
    yellow: ColorFn;
    blue: ColorFn;
    purple: ColorFn;
    cyan: ColorFn;
    white: ColorFn;
    brightBlack: ColorFn;
    brightRed: ColorFn;
    brightGreen: ColorFn;
    brightYellow: ColorFn;
    brightBlue: ColorFn;
    brightPurple: ColorFn;
    brightCyan: ColorFn;
    brightWhite: ColorFn;
};
export interface ColorFn {
    (name: string): string;
    bold: ColorFn;
    dim: ColorFn;
    underline: ColorFn;
    blink: ColorFn;
    inverse: ColorFn;
}
