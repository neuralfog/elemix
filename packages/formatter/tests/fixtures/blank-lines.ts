import { Component, tpl } from '@neuralfog/elemix';
// #component #tag blank-lines
export class BlankLines extends Component {
    template = () => tpl`
        <form>
              <h1>Title</h1>


          <div class="row"><input type="text" /></div>

            <button>Save</button>
        </form>
    `;
}
