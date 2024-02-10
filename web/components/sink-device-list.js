// @ts-check

/**
* Dummy Component
*
* This is just a template for components
*
* [EARLY DRAFT]
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */
</style>
<div id="list">
</div>
`;

export class SinkDeviceList extends HTMLElement {
	#list

	constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		console.log("connectedCallback - SinkDeviceList");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));
		// Add listeners, etc.
		this.#list = this.shadowRoot?.querySelector('#list');

		setInterval(() => {
			const el = document.createElement('span');
			el.innerHTML = "Nice device...";
			this.#list.appendChild(el);
		}, 1000);
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}
}
customElements.define('sink-device-list', SinkDeviceList);
