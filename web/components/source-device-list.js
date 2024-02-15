// @ts-check

import * as AssistantModel from '../models/assistant-model.js';

import './source-item.js';
import './app-button.js';

/**
Source Device List Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */

#scan {
	border-radius: 20px;
}

#container {
	display: flex;
	flex-direction: column;
}
#list {
	display: flex;
	flex-direction: column;
}
</style>
<div id="container">
<app-button id="scan">SCAN SINK</app-button>
<div id="list">
</div>
</div>
`;

export class SourceDeviceList extends HTMLElement {
	#list
	#scanButton
	#model

	constructor() {
		super();

		this.addFoundSource = this.addFoundSource.bind(this);

		const shadowRoot = this.attachShadow({mode: 'open'});
	}

	connectedCallback() {
		console.log("connectedCallback - SourceDeviceList");

		this.shadowRoot?.appendChild(template.content.cloneNode(true));
		// Add listeners, etc.
		this.#scanButton = this.shadowRoot?.querySelector('#scan');
		this.#list = this.shadowRoot?.querySelector('#list');

		this.sendStartSourceScan = this.sendStartSourceScan.bind(this);

		this.#scanButton.addEventListener('click', this.sendStartSourceScan)

		this.#model = AssistantModel.getInstance();

		this.#model.addEventListener('source-found', this.addFoundSource)
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

	sendStartSourceScan() {
		console.log("Clicked Start Source Scan")

		this.#model.startSourceScan();
	}

	addFoundSource(evt) {
		const { source } = evt.detail;

		console.log('EVT', evt);

		// Just use the name for now... ignore duplicates...
		var elements = this.#list.querySelectorAll('source-item');
		var sourceExists = false;
		elements.forEach( e => {
			var sourceName = e.shadowRoot.getElementById('name')?.textContent
			if (sourceName === source.name) {
				sourceExists = true;
				return;
			}
		})

		// TODO: Update RSSI before returning
		if (sourceExists) {
			return;
		}

		const el = document.createElement('source-item');
		this.#list.appendChild(el);
		el.setModel(source);
	}
}
customElements.define('source-device-list', SourceDeviceList);
