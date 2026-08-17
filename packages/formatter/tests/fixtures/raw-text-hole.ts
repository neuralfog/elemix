import { Component, tpl } from '@neuralfog/elemix';
// #component #tag raw-text-hole
export class RawTextHole extends Component {
    template = () => tpl`
        <style>${this.css}</style>
        <style>
            .box { color: ${this.color}; }
        </style>
        <div>${this.label}</div>
    `;
}
