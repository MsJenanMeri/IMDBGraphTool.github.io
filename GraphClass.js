export default class GraphClass {
  constructor() {
    this.graph = {
      nodes: [],
      edges: [],
      nodeDegrees: {}
    };
    this.all_components = null;
    this.indexMap = null;
    this.hashval = null;
  }

  genHash() {
    /*
    Taken from https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    We might want to reuse computations if the graph hasn't changed.
    */
    let s = JSON.stringify(this.graph.nodes.map(n => n.id))
      + JSON.stringify(this.graph.edges.map(e => e.source.id + e.target.id));
    return s.split("").reduce(function (a, b) {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }

  // Problem 6a) Compute average node degree
  computeAverageNodeDegree() {
    let degVals = Object.values(this.graph.nodeDegrees);
    return degVals.reduce((acc, cur) => acc + cur) / degVals.length;
  }

  setIndexMap() {
    /*
    Preprocessing for the more advanced functions. 
    Maps node ids to indices in the graph.nodes array, 
    and converts the node-list/edge-list representation into 
    a adjacency list representation (for each node, there is a list of neighbors).
    */
    let indexMap = new Map();
    this.graph.nodes.forEach((v, i) => {
      v.neighbors = [];
      indexMap.set(v.id, i);
    });

    this.graph.edges.forEach(e => {
      let srcInd = indexMap.get(e.source);
      let tgtInd = indexMap.get(e.target);
      this.graph.nodes[srcInd].neighbors.push(tgtInd);
      this.graph.nodes[tgtInd].neighbors.push(srcInd);
    });
    this.indexMap = indexMap;
    return indexMap;
  }

  // Problem 6b) Number of connected components
  computeConnectedComponents() {
    /*
    Computes the connected components of the graph using a basic traversal 
    algorithm; if there is a path from u-v, then u and v are in the same component.
    Stores the unordered components as an array of sets by node index (not id)
    and returns the length of this array (number of components).
    */
    this.setIndexMap();

    let visted = new Set();
    let traverse = v => {
      visted.add(v);
      let component = new Set();
      component.add(v);
      let Q = [v];

      while (Q.length > 0) {
        let u = Q.pop();
        this.graph.nodes[u].neighbors.forEach(w => {
          if (!visted.has(w)) {
            visted.add(w);
            component.add(w);
            Q.unshift(w);
          }
        });
      };
      return component;
    };

    let all_components = [];
    let cc = 0;
    this.graph.nodes.forEach((n, i) => {
      if (!visted.has(i)) {
        cc += 1;
        let component = traverse(i);
        all_components.push(component);
      }
    });

    this.all_components = all_components;
    return cc;
  }

  // Problem 6c) Compute graph density
  computeGraphDensity() {
    let V = this.graph.nodes.length;
    let E = this.graph.edges.length;

    if (V <= 1) {
      console.log("Density undefined");
      return 0;
    }

    return 2 * E / (V * (V - 1));
  }

  computeLargestComponent() {
    if (!this.all_components) {
      this.computeConnectedComponents();
    }
    this.all_components.sort((a, b) => b.size - a.size);
    return this.all_components[0];
  }

  extractLargestComponent() {
    /*
    Returns largest component as an object with a node-list + edge-list.
    */
    const component = this.computeLargestComponent();
    const indexMap = this.indexMap;

    let subNodes = this.graph.nodes.filter(n => component.has(indexMap.get(n.id)))
    let subEdges = this.graph.edges.filter(
      e => component.has(indexMap.get(e.source)) && component.has(indexMap.get(e.target))
    );

    return {
      "nodes": subNodes,
      "edges": subEdges
    };

  }

  findLargestConnectedComponent() {
    return this.extractLargestComponent();
  }

  computeSSSP(s, nodes) {
    /*
    Computes the single-source-shortest path array, arr
    s.t. arr[i] is the shortest path from parameter v_s to v_i.
    Uses a basic breadth-first-search (unweighted).
    Nodes that are not connected have distance -1 (undefined).
    */
    let Q = [s];
    let visited = new Set();
    visited.add(s);

    let dists = nodes.map(() => -1);
    dists[s] = 0;

    while (Q.length > 0) {
      let u = Q.pop();
      nodes[u].neighbors.forEach(v => {
        if (!visited.has(v)) {
          dists[v] = dists[u] + 1;
          visited.add(v);
          Q.unshift(v)
        }
      });
    }
    return dists;
  }

  computeAPSP() {
    /*
    Computes the all-pairs-shortest-path matrix A, 
    s.t. A[i][j] is the length of the shortest path from v_i to v_j.
    A bit expensive at O(n^2), so let's only recompute it if we 
    have to (i.e. the graph has changed).
    Since we just need this for the diameter, disconnected nodes are represented with 
    A[i][j] = -1.
    */
    this.hashval = this.genHash();
    const nodes = this.graph.nodes;
    // if(this.apsp && this.hashval === this.genHash()){
    //   return this.apsp;
    // }
    return this.apsp = nodes.map((n, i) => this.computeSSSP(i, nodes));
  }

  computeDiameter() {
    this.computeAPSP();
    return Math.max(...this.apsp.flat());
  }

  findGraphDiameter() {
    return this.computeDiameter();
  }

  // Problem 3) Compute Average Shortest Path Length (APL)
  computeAPL() {
    const nodes = this.graph.nodes;
    const edges = this.graph.edges;
    const nodeCount = nodes.length;

    // Create an adjacency matrix with initial values set to Infinity
    const adjacencyMatrix = Array.from({ length: nodeCount }, () => Array(nodeCount).fill(Infinity));

    // Initialize diagonal elements to zero (no distance from a node to itself)
    for (let i = 0; i < nodeCount; i++) {
      adjacencyMatrix[i][i] = 0;
    }

    // Populate the adjacency matrix based on the edges
    for (const edge of edges) {
      const sourceNode = nodes.findIndex(node => node.id === edge.source);
      const targetNode = nodes.findIndex(node => node.id === edge.target);
      const weight = 1; // You can change this if edge weights are provided.

      adjacencyMatrix[sourceNode][targetNode] = weight;
      adjacencyMatrix[targetNode][sourceNode] = weight; // For undirected graphs
    }

    // Floyd-Warshall algorithm to find shortest paths
    for (let k = 0; k < nodeCount; k++) {
      for (let i = 0; i < nodeCount; i++) {
        for (let j = 0; j < nodeCount; j++) {
          if (adjacencyMatrix[i][j] > adjacencyMatrix[i][k] + adjacencyMatrix[k][j]) {
            adjacencyMatrix[i][j] = adjacencyMatrix[i][k] + adjacencyMatrix[k][j];
          }
        }
      }
    }

    // Calculate the sum of all shortest paths and the number of pairs
    let sumShortestPaths = 0;
    let numPairs = 0;

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (adjacencyMatrix[i][j] < Infinity) { // Check if there is a path
          sumShortestPaths += adjacencyMatrix[i][j];
          numPairs++;
        }
      }
    }

    // Calculate the APL
    const apl = sumShortestPaths / numPairs;

    return apl;
  }


}
