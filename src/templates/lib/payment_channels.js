export default `{
	init: \`{
		$close_timeout = 300;
		$addressA = '2QHG44PZLJWD2H7C5ZIWH4NZZVB6QCC7';
		$addressB = 'X55IWSNMHNDUIYKICDW3EOYAWHRUKANP';
		$bFromA = (trigger.address == $addressA);
		$bFromB = (trigger.address == $addressB);
		$bFromParties = ($bFromA OR $bFromB);
		if ($bFromParties)
			$party = $bFromA ? 'A' : 'B';
	}\`,
	messages: {
		cases: [
			{ // refill the AA
				if: \`{ $bFromParties AND trigger.output[[asset=base]] >= 1e5 }\`,
				messages: [
					{
						app: 'state',
						state: \`{
							if (var['close_initiated_by'])
								bounce('already closing');
							if (!var['period'])
								var['period'] = 1;
							$key = 'balance' || $party;
							var[$key] += trigger.output[[asset=base]];
							response[$key] = var[$key];
						}\`
					}
				]
			},
			{ // start closing
				if: \`{ $bFromParties AND trigger.data.close AND !var['close_initiated_by'] }\`,
				messages: [
					{
						app: 'state',
						state: \`{
							$transferredFromMe = trigger.data.transferredFromMe otherwise 0;
							if ($transferredFromMe < 0)
								bounce('bad amount spent by me: ' || $transferredFromMe);
							if (trigger.data.sentByPeer){
								if (trigger.data.sentByPeer.signed_message.channel != this_address)
									bounce('signed for another channel');
								if (trigger.data.sentByPeer.signed_message.period != var['period'])
									bounce('signed for a different period of this channel');
								if (!is_valid_signed_package(trigger.data.sentByPeer, $bFromB ? $addressA : $addressB))
									bounce('invalid signature by peer');
								$transferredFromPeer = trigger.data.sentByPeer.signed_message.amount_spent;
								if ($transferredFromPeer < 0)
									bounce('bad amount spent by peer: ' || $transferredFromPeer);
							}
							else
								$transferredFromPeer = 0;
							var['spentByA'] = $bFromA ? $transferredFromMe : $transferredFromPeer;
							var['spentByB'] = $bFromB ? $transferredFromMe : $transferredFromPeer;
							$finalBalanceA = var['balanceA'] - var['spentByA'] + var['spentByB'];
							$finalBalanceB = var['balanceB'] - var['spentByB'] + var['spentByA'];
							if ($finalBalanceA < 0 OR $finalBalanceB < 0)
								bounce('one of the balances would become negative');
							var['close_initiated_by'] = $party;
							var['close_start_ts'] = timestamp;
							response['close_start_ts'] = timestamp;
							response['finalBalanceA'] = $finalBalanceA;
							response['finalBalanceB'] = $finalBalanceB;
						}\`
					}
				]
			},
			{ // confirm closure
				if: \`{ trigger.data.confirm AND var['close_initiated_by'] }\`,
				init: \`{
					if (!($bFromParties AND var['close_initiated_by'] != $party OR timestamp > var['close_start_ts'] + $close_timeout))
						bounce('too early');
					$finalBalanceA = var['balanceA'] - var['spentByA'] + var['spentByB'];
					$finalBalanceB = var['balanceB'] - var['spentByB'] + var['spentByA'];
				}\`,
				messages: [
					{
						app: 'payment',
						payload: {
							asset: 'base',
							outputs: [
								// fees are paid by the larger party, its output is send-all
								// this party also collects the accumulated 10Kb bounce fees
								{ address: '{$addressA}', amount: "{ $finalBalanceA < $finalBalanceB ? $finalBalanceA : '' }" },
								{ address: '{$addressB}', amount: "{ $finalBalanceA >= $finalBalanceB ? $finalBalanceB : '' }" }
							]
						}
					},
					{
						app: 'state',
						state: \`{
							var['period'] += 1;
							var['close_initiated_by'] = false;
							var['close_start_ts'] = false;
							var['balanceA'] = false;
							var['balanceB'] = false;
							var['spentByA'] = false;
							var['spentByB'] = false;
						}\`
					}
				]
			},
			{ // fraud proof
				if: \`{ trigger.data.fraud_proof AND var['close_initiated_by'] AND trigger.data.sentByPeer }\`,
				init: \`{
					$bInitiatedByA = (var['close_initiated_by'] == 'A');
					if (trigger.data.sentByPeer.signed_message.channel != this_address)
						bounce('signed for another channel');
					if (trigger.data.sentByPeer.signed_message.period != var['period'])
						bounce('signed for a different period of this channel');
					if (!is_valid_signed_package(trigger.data.sentByPeer, $bInitiatedByA ? $addressA : $addressB))
						bounce('invalid signature by peer');
					$transferredFromPeer = trigger.data.sentByPeer.signed_message.amount_spent;
					if ($transferredFromPeer < 0)
						bounce('bad amount spent by peer: ' || $transferredFromPeer);
					$transferredFromPeerAsClaimedByPeer = var['spentBy' || ($bInitiatedByA ? 'A' : 'B')];
					if ($transferredFromPeer <= $transferredFromPeerAsClaimedByPeer)
						bounce("the peer didn't lie in his favor");
				}\`,
				messages: [
					{
						app: 'payment',
						payload: {
							asset: 'base',
							outputs: [
								// send all
								{ address: '{trigger.address}' }
							]
						}
					},
					{
						app: 'state',
						state: \`{
							var['period'] += 1;
							var['close_initiated_by'] = false;
							var['close_start_ts'] = false;
							var['balanceA'] = false;
							var['balanceB'] = false;
							var['spentByA'] = false;
							var['spentByB'] = false;
						}\`
					}
				]
			}
		]
	}
}`
