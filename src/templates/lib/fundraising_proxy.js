export default `{
	/*
	This is a fundraising proxy AA.

	It allows to raise money up to a specific target.  If the target is reached, the money is forwarded to another AA, otherwise the money is refunded.

	This specific example raises money for challenging the current candidate winner in 51% attack game.  The target is a moving target as other teams may be adding contributions at the same time.

	Contributors get shares of the proxy in exchange for Bytes.  They can exchange the shares back to the same amount of Bytes any time before the target is reached.  As soon as the target is reached, the raised funds are forwarded to the game and the proxy receives the shares of the team in exchange.  Then, the contributors can exchange the shares of the proxy for the shares of the team.
	*/

	init: \`{
		$asset = var['asset'];
		$destination_aa = 'WWHEN5NDHBI2UF4CLJ7LQ7VAW2QELMD7';
		$team = 'VF5UVKDSOXPMITMDGYXEIGUJSQBRAMMN';
	}\`,
	messages: {
		cases: [
			{ // start a new fundraising period
				if: \`{trigger.data.start AND !$asset}\`,
				messages: [
					{
						app: 'asset',
						payload: {
							is_private: false,
							is_transferrable: true,
							auto_destroy: false,
							fixed_denominations: false,
							issued_by_definer_only: true,
							cosigned_by_definer: false,
							spender_attested: false
						}
					},
					{
						app: 'state',
						state: \`{
							var[response_unit || '_status'] = 'open';
							var['asset'] = response_unit;
							response['asset'] = response_unit;
						}\`
					}
				]
			},
			{ // contribute
				if: \`{trigger.output[[asset=base]] >= 1e5 AND $asset}\`,
				init: \`{
					if (var[$destination_aa]['finished'])
						bounce('game over');
					$amount = trigger.output[[asset=base]] - 2000; // to account for fees we need to respond now and to refund bytes or pay shares later
					$total_raised = var['total_raised'] + $amount;
					$missing_amount = ceil((balance[$destination_aa][base] + $total_raised)*0.51) - var[$destination_aa]['team_' || $team || '_amount'];
					$bDone = ($total_raised > $missing_amount);
				}\`,
				messages: [
					{
						app: 'payment',
						payload: {
							asset: "{$asset}",
							outputs: [{address: "{trigger.address}", amount: "{$amount}"}]
						}
					},
					{
						if: \`{$bDone}\`,
						app: 'payment',
						payload: {
							asset: "base",
							outputs: [{address: "{$destination_aa}", amount: "{$total_raised}"}]
						}
					},
					{
						if: \`{$bDone}\`,
						app: 'data',
						payload: {
							team: "{$team}"
						}
					},
					{
						app: 'state',
						state: \`{
							if ($bDone)
								var[$asset || '_status'] = 'raised';
							else
								var['total_raised'] = $total_raised;
						}\`
					}
				]
			},
			{ // received team asset
				if: \`{trigger.output[[asset=var[$destination_aa]['team_' || $team || '_asset']]] AND $asset}\`,
				messages: [
					{
						app: 'state',
						state: \`{
							var[$asset || '_status'] = 'done';
							var['asset'] = false;
							var['total_raised'] = false;
						}\`
					}
				]
			},
			{ // refund
				if: \`{$asset AND trigger.output[[asset=$asset]] > 0}\`,
				init: \`{
					$amount = trigger.output[[asset=$asset]];
				}\`,
				messages: [
					{
						app: 'payment',
						payload: {
							asset: "base",
							outputs: [{address: "{trigger.address}", amount: "{$amount}"}]
						}
					},
					{
						app: 'state',
						state: \`{
							var['total_raised'] -= $amount;
						}\`
					}
				]
			},
			{ // pay the obtained team asset in exchange for the issued asset
				if: \`{
					$in_asset = trigger.output[[asset!=base]].asset;
					var[$in_asset || '_status'] == 'done'
				}\`,
				messages: [
					{
						app: 'payment',
						payload: {
							asset: "{var[$destination_aa]['team_' || $team || '_asset']}",
							outputs: [{address: "{trigger.address}", amount: "{trigger.output[[asset=$in_asset]]}"}]
						}
					},
				]
			}
		]
	}
}`
