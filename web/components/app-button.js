// @ts-check

/*
* App Button Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */
button {
	display: block;
	position: relative;
	box-sizing: border-box;
	min-width: 5.14em;
        width: 100%;
	margin: 0.2em;
	background: transparent;
	text-align: center;
	font: inherit;
	text-transform: uppercase;
	outline: none;
	border-radius: 5px;
	user-select: none;
	cursor: pointer;
	z-index: 0;
	padding: 0.7em 0.57em;
	box-shadow: 0 2px 2px 0 rgba(0,0,0,0.14), 0 1px 5px 0 rgba(0,0,0,0.12), 0 3px 1px -2px rgba(0,0,0,0.2);
	background-color: var(--background-color, darkgray);
	color: white;
      }

button:hover {
	box-shadow: 0 3px 3px 0 rgba(0,0,0,0.14), 0 1px 7px 0 rgba(0,0,0,0.12), 0 3px 1px -1px rgba(0,0,0,0.2);
	background-color: var(--background-color-hover, gray);
}
</style>
<button><slot></slot></button>
`;

export class AppButton extends HTMLElement {
        constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
                shadowRoot.appendChild(template.content.cloneNode(true));
	}

}
customElements.define('app-button', AppButton);
