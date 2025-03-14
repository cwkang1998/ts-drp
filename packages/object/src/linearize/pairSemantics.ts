import { type Vertex_Operation as Operation } from "@ts-drp/types";

import { ActionType, type Hash, type HashGraph } from "../hashgraph/index.js";
import type { ObjectSet } from "../utils/objectSet.js";

export function linearizePairSemantics(
	hashGraph: HashGraph,
	origin: Hash,
	subgraph: ObjectSet<string>
): Operation[] {
	const order = hashGraph.topologicalSort(true, origin, subgraph);
	const dropped = new Array<boolean>(order.length).fill(false);
	const result: Operation[] = [];

	// Skip root operation
	for (let i = 1; i < order.length; i++) {
		if (dropped[i]) continue;

		let anchor = order[i];
		let modified = false;

		// Compare with all later operations
		for (let j = i + 1; j < order.length; j++) {
			if (dropped[j] || hashGraph.areCausallyRelatedUsingBitsets(anchor, order[j])) {
				continue;
			}

			const v1 = hashGraph.vertices.get(anchor);
			const v2 = hashGraph.vertices.get(order[j]);

			if (!v1 || !v2) {
				continue;
			}

			const { action } = hashGraph.resolveConflicts([v1, v2]);

			switch (action) {
				case ActionType.DropLeft:
					dropped[i] = true;
					modified = true;
					break;
				case ActionType.DropRight:
					dropped[j] = true;
					break;
				case ActionType.Swap:
					hashGraph.swapReachablePredecessors(order[i], order[j]);
					[order[i], order[j]] = [order[j], order[i]];
					j = i + 1;
					anchor = order[i];
					break;
			}

			if (modified) break;
		}

		if (!dropped[i]) {
			const vertex = hashGraph.vertices.get(order[i]);
			if (vertex?.operation && vertex.operation.value !== null) {
				result.push(vertex.operation);
			}
		}
	}
	return result;
}
