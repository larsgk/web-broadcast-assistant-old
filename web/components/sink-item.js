// @ts-check

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

</style>
<div>
<span id="name"></span>
<span id="addr"></span>
<span id="uuid16s"></span>
<span id="rssi"></span>
</div>
`;

export class SinkItem extends HTMLElement {
	#sink
	#nameEl
	#addrEl
	#uuid16sEl
	#rssiEl
	
	constructor() {
		super();
		
		const shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(template.content.cloneNode(true));
	}
	
	connectedCallback() {
		this.#nameEl = this.shadowRoot?.querySelector('#name');
		this.#addrEl = this.shadowRoot?.querySelector('#addr');
		this.#uuid16sEl = this.shadowRoot?.querySelector('#uuid16s');
		this.#rssiEl = this.shadowRoot?.querySelector('#rssi');
	}
	
	setModel(sink) {
		this.#sink = sink;
		
		// Set name (and more...)
		this.#nameEl.textContent = this.#sink.name;
		this.#addrEl.textContent = this.#sink.addr;
		this.#rssiEl.textContent = `RSSI: ${this.#sink.rssi}`;

		this.#uuid16sEl.textContent = `UUID16s: [${this.#sink.uuid16s?.map(
			a => {return '0x'+a.toString(16)}
			)} ]`;
		}
	}
	customElements.define('sink-item', SinkItem);
	