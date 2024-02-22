// @ts-check

import { BT_DataType } from '../lib/message.js';

/*
* Sink Item Component
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
	box-shadow: 3px 3px 6px 3px gray;
	transition: box-shadow 0.5s ease-out;
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

#uuid16s {
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

#card[state="connected"] {
	background-color: lightgreen;
	box-shadow: 1px 1px 2px 2px gray;
}

#card[state="connecting"] {
	background-color: lightyellow;
	box-shadow: 3px 3px 6px 3px gray;
}

#card[state="failed"] {
	background-color: rgb(255,128,128);
	box-shadow: 3px 3px 6px 3px gray;
}

</style>
<div id="card">
<span id="name"></span>
<span id="addr"></span>
<span id="uuid16s"></span>
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

export class SinkItem extends HTMLElement {
	#sink
	#cardEl
	#nameEl
	#addrEl
	#uuid16sEl
	#rssiEl

	constructor() {
		super();

		this.setModel = this.setModel.bind(this);
		this.refresh = this.refresh.bind(this);

		const shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(template.content.cloneNode(true));
	}

	connectedCallback() {
		this.#cardEl = this.shadowRoot?.querySelector('#card');
		this.#nameEl = this.shadowRoot?.querySelector('#name');
		this.#addrEl = this.shadowRoot?.querySelector('#addr');
		this.#uuid16sEl = this.shadowRoot?.querySelector('#uuid16s');
		this.#rssiEl = this.shadowRoot?.querySelector('#rssi');
	}

	refresh() {
		this.#nameEl.textContent = this.#sink.name;
		this.#addrEl.textContent = `Addr: ${addrString(this.#sink.addr)}`;
		this.#rssiEl.textContent = `RSSI: ${this.#sink.rssi}`;

		this.#uuid16sEl.textContent = `UUID16s: [${this.#sink.uuid16s?.map(a => {return '0x'+a.toString(16)})} ]`;

		this.#cardEl.setAttribute('state', this.#sink.state);
	}

	setModel(sink) {
		this.#sink = sink;

		this.refresh();
	}

	getModel() {
		return this.#sink;
	}
}
customElements.define('sink-item', SinkItem);
