// @ts-check

import { BT_DataType } from '../lib/message.js';

/*
* Source Item Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */
div {
	display: block;
	position: relative;
	box-sizing: border-box;
	min-width: 5.14em;
	height: 75px;
	width: 100%;
	margin: 0.2em;
	background: transparent;
	text-align: center;
	border-radius: 5px;
	border: 1px black solid;
	user-select: none;
	cursor: pointer;
	padding: 0.7em 0.57em;
	background-color: var(--background-color, white);
	color: black;
}

#name {
	position: absolute;
	left: 5px;
	top: 5px;
	font-size: 1.2em;
}

#addr {
	position: absolute;
	left: 5px;
	top: 30px;
	font-size: 0.9em;
}

#broadcast_name {
	position: absolute;
	top: 5px;
	font-size: 1.2em;
}

#broadcast_id {
	position: absolute;
	left: 5px;
	bottom: 5px;
	font-size: 0.9em;
}

#rssi {
	position: absolute;
	right: 5px;
	bottom: 5px;
	font-size: 0.9em;
}

</style>
<div>
<span id="name"></span>
<span id="broadcast_name"></span>
<span id="addr"></span>
<span id="broadcast_id"></span>
<span id="rssi"></span>
</div>
`;

const addrString = (addr) => {
	if (!addr) {
		return "Unknown address";
	}

	const val = addr.value;

	if (addr.type === BT_DataType.BT_DATA_RAND_TARGET_ADDR) {
		return `${val} (random)`;
	} else if (addr.type === BT_DataType.BT_DATA_PUB_TARGET_ADDR) {
		return `${val} (public)`;
	}
}

export class SourceItem extends HTMLElement {
	#source
	#nameEl
	#broadcastNameEl
	#addrEl
	#broadcastIdEl
	#rssiEl

	constructor() {
		super();

		this.setModel = this.setModel.bind(this);
                this.refresh = this.refresh.bind(this);

		const shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(template.content.cloneNode(true));
	}

	connectedCallback() {
		this.#nameEl = this.shadowRoot?.querySelector('#name');
		this.#broadcastNameEl = this.shadowRoot?.querySelector('#broadcast_name');
		this.#addrEl = this.shadowRoot?.querySelector('#addr');
		this.#broadcastIdEl = this.shadowRoot?.querySelector('#broadcast_id');
		this.#rssiEl = this.shadowRoot?.querySelector('#rssi');
	}

	refresh() {
		// Set name (and more...)
		this.#nameEl.textContent = this.#source.name;
		this.#broadcastNameEl.textContent = this.#source.broadcast_name;
		this.#addrEl.textContent = `Addr: ${addrString(this.#source.addr)}`;
		this.#rssiEl.textContent = `RSSI: ${this.#source.rssi}`;
		this.#broadcastIdEl.textContent = `Broadcast ID: 0x${
			this.#source.broadcast_id?.toString(16).toUpperCase()}`;
	}

	setModel(source) {
		this.#source = source;

		this.refresh();
	}

	getModel() {
		return this.#source;
	}
}
customElements.define('source-item', SourceItem);
