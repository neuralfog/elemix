import { Component } from '@neuralfog/elemix';

// Every way a custom-element tag can be invalid — each surfaces as a WARNING
// (these do NOT fail the build; only errors do). `customElements.define` would
// throw on every one of these at registration.

// no hyphen — the derived tag is `button`
// #component
export class Button extends Component {}

// uppercase letters are not allowed
// #component #tag my-Card
export class UpperTag extends Component {}

// a name reserved by SVG/MathML
// #component #tag font-face
export class ReservedTag extends Component {}

// must start with a lowercase ASCII letter, not a digit
// #component #tag 1-card
export class DigitStartTag extends Component {}

// contains an invalid character
// #component #tag my-c@rd
export class BadCharTag extends Component {}
