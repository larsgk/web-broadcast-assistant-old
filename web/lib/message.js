// @ts-check

import { cobsEncode, cobsDecode } from './cobs.js';

/**
* This module contains enums and functions related to messages
*
* message format:
*      {
*              type,           // 1byte, CMD, RES or EVT
*              subType,        // 1byte, e.g. START_SINK_SCAN (CMD/RES) or SINK_FOUND (EVT)
*              seqNo,          // 1byte, (to match CMD & RES, detect missing EVT)
*              payloadSize,    // 2byte, byte length of payload
*              payload         // Nbytes (payload for further processing, Uint8Array)
*      }
*/

export const MessageType = Object.freeze({
	CMD: 1,
	RES: 2,
	EVT: 3
});

export const MessageSubType = Object.freeze({
	// CMD/RES (MSB = 0)
	START_SINK_SCAN:	0x01,
	START_SOURCE_SCAN:	0x02,

	DUMMY:			0x7F,

	// EVT (MSB = 1)
	SINK_FOUND:		0x81,
	SOURCE_FOUND:		0x82,

	HEARTBEAT:		0xFF,
});

export const msgToArray = msg => {
	// Simple validation
	if (!Object.values(MessageType).includes(msg?.type)) {
		throw new Error(`Message type invalid (${msg?.type})`);
	}

	if (!Object.values(MessageSubType).includes(msg?.subType)) {
		throw new Error(`Message subType invalid (${msg?.subType})`);
	}
	// TBD: Maybe check subType MSB against message type

	// If seqNr is anything but an integer between 0 and 255, default to 0.
	// Note: This also means that it can be omitted and default to 0.
	let seqNo = msg?.seqNo;
	if (!Number.isInteger(seqNo) || seqNo < 0 || seqNo > 255) {
		seqNo = 0;
	}

	// If payloadSize is omitted, it will be set to the length of the payload
	// The payload can be 'undefined' or an Uint8Array, if undefined, length = 0
	let payloadSize = msg?.payloadSize;
	if (payloadSize !== undefined && msg.payload === undefined) {
		throw new Error(`payloadSize must be omitted if payload is omitted`);
	}

	if (msg.payload instanceof Uint8Array) {
		const actSize = msg.payload.length;
		if (payloadSize === undefined) {
			payloadSize = actSize;
		} else if (Number.isInteger(payloadSize)) {
			if (payloadSize !== actSize) {
				throw new Error(`Actual payload size (${actSize})` +
						` != payloadSize (${msg.payloadSize})`);
			}
		} else {
			throw new Error(`Invalid payloadSize (${payloadSize})`);
		}
	} else if (msg.payload === undefined) {
		payloadSize = 0;
	} else {
		throw new Error("If set, payload must be a Uint8Array");
	}

	console.log('Validation complete...');

	const header = new Uint8Array([msg.type, msg.subType, seqNo, payloadSize & 0xff, payloadSize >> 8]);

	if (msg.payload instanceof Uint8Array && msg.payload.length !== 0) {
		const msgWithPayload = new Uint8Array(header.length + msg.payload.length);
		msgWithPayload.set(header);
		msgWithPayload.set(msg.payload, header.length);

		return msgWithPayload;
	}

	return header;
}

export const arrayToMsg = data => {
	if (!(data instanceof Uint8Array)) {
		throw new Error("Input data must be a Uint8Array");
	}

	if (data.length < 5) {
		throw new Error(`Array too short (${data.length} < 5)`);
	}

	const payloadSize = data[3] + (data[4] << 8);
	if (data.length !== payloadSize + 5) {
		throw new Error(`Actual payload size (${data.length - 5}) != payloadSize (${payloadSize})`);
	}

	// TODO: Full validation
	console.log('Validation complete...');

	return {
		type: data[0],
		subType: data[1],
		seqNo: data[2],
		payloadSize,
		payload: data.slice(5)
	}
}

export const parseLTV = ltv => {
	/**
	 *  This should parse the LTV structure and produce an object looking something like:
	 *
	 * {
	 * 	bt_name: string | undefined
	 * 	uuid16: []
	 * 	rssi: int8
	 * }
	 */

	// Just return a stupid mock rock now
	return {
		bt_name: "my_device",
		broadcast_id: "a_nice_id",
		rssi: 0
	 }
}