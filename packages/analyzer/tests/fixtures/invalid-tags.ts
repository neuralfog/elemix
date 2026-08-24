import { Component } from '@neuralfog/elemix';


// #component
export class Button extends Component {}

// #component #tag my-Card
export class UpperTag extends Component {}

// #component #tag font-face
export class ReservedTag extends Component {}

// #component #tag 1-card
export class DigitStartTag extends Component {}

// #component #tag my-c@rd
export class BadCharTag extends Component {}
