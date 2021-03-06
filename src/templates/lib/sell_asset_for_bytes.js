export default `{
	init: \`{
		$my_address = '2QHG44PZLJWD2H7C5ZIWH4NZZVB6QCC7';
	}\`,
	messages: {
		cases: [
			{ // withdraw funds
				if: "{trigger.data.withdraw AND trigger.data.asset AND trigger.data.amount AND trigger.address == $my_address}",
				messages: [{
					app: 'payment',
					payload: {
						asset: "{trigger.data.asset}",
						outputs: [
							{address: "{trigger.address}", amount: "{trigger.data.amount}"}
						]
					}
				}]
			},
			{ // update exchange rate
				if: "{trigger.data.exchange_rate AND trigger.address == $my_address}",
				messages: [{
					app: 'state',
					state: "{ var['rate'] = trigger.data.exchange_rate; response['message'] = 'set exchange rate to '||var['rate']||' tokens/byte'; }"  // asset-units/byte
				}]
			},
			{ // exchange
				if: "{trigger.output[[asset=base]] > 100000}",
				init: "{ $bytes_amount = trigger.output[[asset=base]]; $asset_amount = round($bytes_amount * var['rate']); response['message'] = 'exchanged '||$bytes_amount||' bytes for '||$asset_amount||' asset.'; }",
				messages: [{
					app: 'payment',
					payload: {
						asset: "n9y3VomFeWFeZZ2PcSEcmyBb/bI7kzZduBJigNetnkY=",
						outputs: [
							{address: "{trigger.address}", amount: "{ $asset_amount }"}
						]
					}
				}]
			},
			{ // silently accept coins
				messages: [{
					app: 'state',
					state: "{ response['message'] = 'accepted coins: '||trigger.output[[asset=base]]||' bytes and '||trigger.output[[asset='n9y3VomFeWFeZZ2PcSEcmyBb/bI7kzZduBJigNetnkY=']]||' tokens.'; }"
				}]
			},
		]
	}
}`
