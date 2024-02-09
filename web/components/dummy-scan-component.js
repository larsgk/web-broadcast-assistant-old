// @ts-check

import { MessageType, MessageSubType } from '../lib/message.js';
import { AssistantModel } from '../models/assistant-model.js';

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
<div>
Dummy content
</div>
`;

export class DummyScanComponent extends HTMLElement {
	constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(template.content.cloneNode(true));
	}

	connectedCallback() {
		// Add listeners, etc.
	}

	disconnectedCallback() {
		// Remove listeners, etc.
	}

	sendStartSinkScan() {
		
		// Just placeholders, this is not how components should work
		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.START_SINK_SCAN,
			seqNo: 123,
			payload: new Uint8Array([])
		};
		
		this.dispatchEvent(new CustomEvent('message', { detail: { message }}));
	}
	
	sendStartSourceScan() {
		
		// Just placeholders, this is not how components should work
		const message = {
			type: Number(MessageType.CMD),
			subType: MessageSubType.START_SOURCE_SCAN,
			seqNo: 123,
			payload: new Uint8Array([])
		};

		this.dispatchEvent(new CustomEvent('message', { detail: { message }}));
	}
}
customElements.define('dummy-component', DummyScanComponent);
