// import the GraphClass definiton from GraphClass.js
import GraphClass from './GraphClass.js';

var interactiveGraph;

/*
    Given some JSON data representing a graph, render it with D3
*/
// dummy commit
function renderGraph(graphData) {
    let graphView;
    if (!interactiveGraph) {
        graphView = new GraphView("#svgGraph", graphData.nodes, graphData.edges);

        graphView.draw();
        graphView.startSim(graphView.height);
        // graphView.rescale();
        graphView.addClickListener();
        graphView.addDragListener();
        graphView.showText();

        let nameButton = document.getElementById("showText");
        nameButton.value = 0;

        nameButton.addEventListener("click", () => {
            let val = Number(nameButton.value);
            if (val === 0)
                graphView.addAllText();
            else
                graphView.removeAllText();
            nameButton.value ^= 1;
        });

        const searchButton = document.getElementById('search-button');
        const searchInput = document.getElementById('search-input');
        searchButton.addEventListener('click', () => {
            const inputValue = searchInput.value;
            graphView.queryId(inputValue);
        });

        const switchButton = document.getElementById('switchLayout');
        switchButton.addEventListener('click', () => {
            graphView.removeHighlight();
            if (graphView.layout === "fda")
                graphView.linearLayout("year");
            else {
                graphView.setGraph(graphView.nodes, graphView.edges.map(e => {
                    return { "source": e.source.id, "target": e.target.id }
                }));
                graphView.draw();
                graphView.startSim(graphView.height);
            }
        });


        interactiveGraph = graphView;
    }
    else {
        graphView = interactiveGraph;
        graphView.setGraph(graphData.nodes, graphData.edges);
        graphView.draw();
        graphView.startSim(graphView.height);
    }

}

/*
    Function to fetch the JSON data from output_graph.json & call the renderGraph() method
    to visualize this data
*/
function loadAndRenderGraph(fileName, G) {
    if (!G) {
        G = new GraphClass();
    }
    fetch(fileName)
        .then(response => response.json())
        .then(jsonData => {
            G.graph.nodes = jsonData.nodes;
            G.graph.edges = jsonData.links;
            renderGraph(G.graph);
        });
}

function passClientGraphToServer() {
    let indMap = new Map();
    graphObj.graph.nodes = interactiveGraph.nodes;
    graphObj.graph.edges = interactiveGraph.edges.map(e => {
        return { "source": e.source.id, "target": e.target.id }
    });

    graphObj.graph.nodes.forEach((n, i) => {
        n.degree = 0;
        indMap.set(n.id, i);
    });

    graphObj.graph.edges.forEach(e => {
        graphObj.graph.nodes[indMap.get(e.source)].degree++;
        graphObj.graph.nodes[indMap.get(e.target)].degree++;
    });

    let degs = {};
    graphObj.graph.nodes.forEach(n => {
        degs[n.id] = n.degree;
    });
    graphObj.graph.nodeDegrees = degs;

    return graphObj;
}

/*
    A method to compute simple statistics (Programming part Subproblem 6)
    on updated graph data
*/
function displayGraphStatistics(graphObj) {
    /*
    Computes the required graph statistics. Functionality for compute button is left, 
    we also check every second to see if the graph has changed (nodes/edges added or removed).
    If it has, we automatically update the stats (largely making button vestigial).
    */

    function computeStats(graph) {
        let avgDeg = graph.computeAverageNodeDegree();
        let connectedComponent = graph.computeConnectedComponents();
        let density = graph.computeGraphDensity();
        let diameter = graph.computeDiameter();
        let apl = graph.computeAPL();

        document.getElementById("avgDegree").innerHTML = avgDeg;
        document.getElementById("numComponents").innerHTML = connectedComponent;
        document.getElementById("graphDensity").innerHTML = density;
        document.getElementById("diameter").innerHTML = diameter;
        document.getElementById("apl").innerHTML = apl;
    }

    let statButton = document.getElementById("computeStats");

    statButton.addEventListener("click", () => {
        if (interactiveGraph) {
            let graphObj = passClientGraphToServer();
            computeStats(graphObj);
        }
    });

    setInterval(() => {
        let graphObj = passClientGraphToServer()
        let hash = graphObj.genHash();
        if (hash !== graphObj.hashval) {
            computeStats(graphObj)
            graphObj.hashval = hash;
        }
    }, 1000)

}

function addExtractButton() {
    let button = document.getElementById("largestComp");
    button.value = 0;
    button.addEventListener("click", () => {
        let val = Number(button.value);
        if (interactiveGraph && val === 0) {
            let graphObj = passClientGraphToServer();
            let subGraph = graphObj.extractLargestComponent();
            renderGraph(subGraph);
        } else if (interactiveGraph && val === 1) {
            loadAndRenderGraph("output_graph.json");
        }
        button.value ^= 1;
    });
}

function handleAttributeUpdate() {
    const nodeIdInput = document.getElementById("nodeIdInput").value;
    const attributeInput = document.getElementById("attributeInput").value;
    const newValueInput = document.getElementById("newValueInput").value;

    // Check if interactiveGraph is defined
    if (interactiveGraph) {
        // Call the method to update node attributes
        interactiveGraph.updateNodeAttributes(nodeIdInput, attributeInput, newValueInput);

        // After updating, redraw the graph
        interactiveGraph.draw();
    } else {
        console.log("Interactive graph is not initialized.");
    }
}

// Attach the event listener to the update attribute button
const updateAttributeButton = document.getElementById("updateAttributeButton");
updateAttributeButton.addEventListener("click", handleAttributeUpdate);


// Add event listener for removing a node
document.getElementById("search-node-button").addEventListener("click", () => {
    const nodeId = document.getElementById("search-node-input").value;
    if (nodeId) {
        interactiveGraph.removeNode(nodeId);
        interactiveGraph.draw(); // Redraw the graph to reflect the changes
    }
});

// Add event listener for removing an edge
document.getElementById("search-edge-button").addEventListener("click", () => {
    const sourceNodeId = document.getElementById("search-edge-source-input").value;
    const targetNodeId = document.getElementById("search-edge-target-input").value;

    if (sourceNodeId && targetNodeId) {
        interactiveGraph.removeEdge(sourceNodeId, targetNodeId);
        interactiveGraph.draw(); // Redraw the graph to reflect the changes
    }
});


// instantiate an object of GraphClass
let graphObj = new GraphClass();

// your saved graph file from Homework 1
let fileName = "output_graph.json";


// render the graph in the browser
loadAndRenderGraph(fileName, graphObj);

// compute and display simple statistics on the graph
displayGraphStatistics(graphObj);

addExtractButton();
handleAttributeUpdate();
