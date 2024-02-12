// @ts-check

import * as AssistantModel from '../models/assistant-model.js';

/**
Source Device List Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */
#container {
	display: flex;
	flex-direction: column;
	width: 95%;
	max-width: 700px;
	background: green;
}
#list {
	display: flex;
	flex-direction: column;
}
</style>
<div id="container">
<button id="scansrcbtn">SCAN SOURCE</button>
<div id="list">
</div>
</div>
`;

export class SourceDeviceList extends HTMLElement {
	#list
	#scanButton

	constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		console.log("connectedCallback - SourceDeviceList");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));
		// Add listeners, etc.
		this.#scanButton = this.shadowRoot?.querySelector('#scansrcbtn');
		this.#list = this.shadowRoot?.querySelector('#list');

		this.sendStartSourceScan = this.sendStartSourceScan.bind(this);

		this.#scanButton.addEventListener('click', this.sendStartSourceScan)
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

	sendStartSourceScan() {
		console.log("Clicked Start Source Scan")

		let model = AssistantModel.getInstance();
		model.startSourceScan();

		// Add fake device element
		const el = document.createElement('span');
		el.innerHTML = "Nice device...";
		this.#list.appendChild(el);
	}
}
customElements.define('source-device-list', SourceDeviceList);
