class GraphView {
    #nodeRadius = 5;
    #margin = { "top": 15, "bottom": 15, "left": 20, "right": 15 };

    constructor(svgId, nodes, edges) {

        this.svg = d3.select(svgId);
        this.width = this.svg.node().getBoundingClientRect().width;
        this.height = this.svg.node().getBoundingClientRect().height;
        this.layer1 = this.svg.append("g");
        this.layer2 = this.layer1.append("g");

        this.setGraph(nodes, edges);

        this.zoomLevel = d3.zoomIdentity;
        this.currentSource = null;
        this.currentTarget = null;
        this.tmpLine = null;

        this.layout = "fda";

    }

    setGraph(nodes, edges) {
        /*
        Sets up the internal class graph structure (node-list + edge-list)
        and sets up a force-directed simulation. 
        d3.forceLink will automatically convert the "source" and "target" fields from id strings 
        to node objects.
        */

        //Need a deep copy so we don't modify the backend data.
        this.nodes = JSON.parse(JSON.stringify(nodes));
        this.edges = JSON.parse(JSON.stringify(edges));

        this.nodes.forEach(n => {
            n.rank = Number(n.rank);
            n.fx = null;
            n.fy = null;
            n.showText = false;
        });

        if (this.sim)
            this.sim.on("tick", null);

        this.sim = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.edges).id(n => n.id))
            .force("repulse", d3.forceManyBody().strength(-50).distanceMax(50 * this.#nodeRadius))
            // .force("y", d3.forceY(height / 2).strength(1e-1))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .stop();

        this.calcDegree();
        this.sim.nodes(this.nodes)
        this.layout = "fda";
    }

    calcDegree() {
        this.nodes.forEach(n => n.degree = 0);
        this.edges.forEach(e => {
            e.source.degree++;
            e.target.degree++;
        });
    }

    showText() {
        /*
        Controls which labels are drawn. Each node has an attribute showText that tells 
        the program whether we draw the label. 
        This is for future-proofing with smarter labeling.
        */
        const t = d3.transition().duration(750);

        // Assuming you have a dropdown with the id "dropdown-element"
        const labelType = document.getElementById("dropdown-element").value;

        this.layer1.selectAll(".names")
            .data(this.nodes.filter(n => n.showText), n => n.id)
            .join(
                enter => enter.append("text")
                    .attr("class", "names")
                    .attr("x", n => n.x)
                    .attr("y", n => n.y)
                    .attr("text-anchor", "middle")
                    .attr("font-size", 10)
                    .text(n => {
                        if (labelType === "movieName") {
                            return n.name;
                        } else if (labelType === "genre") {
                            return n.genre;
                        } else if (labelType === "director") {
                            return n.director_name;
                        } else if (labelType === "movieID") {
                            return n.id;
                        }
                        // Add more cases for other label types
                        return ""; // Default case
                    }),
                update => update.attr("x", n => n.x).attr("y", n => n.y),
                exit => exit.remove()
            );
    }

    addAllText() {
        this.nodes.forEach(n => n.showText = true);
        this.showText();
    }

    removeAllText() {
        this.nodes.forEach(n => n.showText = false);
        this.showText();
    }

    startSim(ystop) {
        /*
        Initialized force-directed simulation, and sets the nodes/edges positions to update 
        at each tick (frame).
        */
        let ticked = () => {

            let xbound = x => Math.max(this.#nodeRadius, Math.min(this.width - this.#nodeRadius, x));
            let ybound = y => Math.max(this.#nodeRadius, Math.min(ystop - this.#nodeRadius, y))

            this.layer1.selectAll(".links")
                .attr("x1", e => e.source.x)
                .attr("y1", e => e.source.y)
                .attr("x2", e => e.target.x)
                .attr("y2", e => e.target.y);

            this.layer1.selectAll(".nodes")
                .attr("cx", n => n.x = xbound(n.x))
                .attr("cy", n => n.y = ybound(n.y));

            this.showText();

        }

        this.sim.on('tick', ticked);
        this.sim.restart();
    }

    draw() {
        /*
        Basic draw routine. 
        */
        const t = d3.transition().duration(750)

        if (this.layout === "fda") {
            this.layer1.selectAll(".arcs").transition(t).remove();
            this.layer1.selectAll(".links")
                .data(this.edges, e => e.source.id + e.target.id)
                .join(
                    enter =>
                        enter.append("line")
                            .attr("class", "links")
                            .attr("x1", e => e.source.x)
                            .attr("y1", e => e.source.y)
                            .attr("x2", e => e.target.x)
                            .attr("y2", e => e.target.y)
                            .attr("stroke", "black")
                            .attr("opacity", 0.5)
                            .attr("transform", this.zoomLevel),
                    update => update,
                    exit => exit.transition(t).attr("stroke-width", 1e-12).remove()
                );
        } else if (this.layout === "linear") {
            this.drawArcs();
        }

        this.layer1.selectAll(".nodes")
            .data(this.nodes, d => d.id)
            .join(
                enter =>
                    enter.append("circle")
                        .attr("class", "nodes")
                        .attr("cx", n => n.x)
                        .attr("cy", n => n.y)
                        .attr("r", this.#nodeRadius)
                        .attr("fill", "lightblue")
                        .attr("stroke", "black")
                        .attr("transform", this.zoomLevel),
                update =>
                    this.layout === "fda" ?
                        update
                        :
                        update.transition(t)
                            .attr("cx", n => n.x)
                            .attr("cy", n => n.y),
                exit => exit.transition(t).attr("r", 1e-12).remove()
            ).raise();

        if (this.layout === "fda") {
            this.sim.nodes(this.nodes);

            this.sim.alpha(0.5);
            this.sim.restart();
        }


    }

    drawArcs() {
        /*
        Draws arcs for edges between vertices in linear layout. 
        Code modified from https://observablehq.com/@d3/arc-diagram
        */

        const t = d3.transition().duration(750);
        function arc(d) {
            const x1 = d.source.fx;
            const x2 = d.target.fx;
            const y = d.source.y;
            const r = Math.abs(x2 - x1) / 1.5;
            return `M${x1},${y}A${r},${r} 0,0,${x1 > x2 ? 1 : 0} ${x2},${y}`;
        }

        this.layer1.selectAll(".arcs")
            .data(this.edges, e => e.source.id + e.target.id)
            .join(
                enter =>
                    enter.append("path")
                        .attr("class", "arcs")
                        .attr("fill", "none")
                        .attr("stroke-opacity", 0.6)
                        .attr("stroke-width", 1.5)
                        .attr("stroke", "grey")
                        .attr("opacity", 0.3)
                        .attr("d", arc),
                update => update,
                exit => exit.transition(t).attr("stroke-width", 1e-12).remove()
            )

    }

    addClickListener() {
        /*
        Handles the click functionality, which should add a node to the graph with default attributes. 
        */
        this.svg.on("click", e => {
            if (this.currentSource)
                return;

            let [x, y] = d3.pointer(e);
            this.nodes.push({
                'id': this.nodes.length.toString(),
                'x': x,
                'y': y,
                'year': 2023
            });
            this.draw();
            this.addDragListener();
        });

        this.svg.on("dblclick", null);

        this.layer1.selectAll(".nodes")
            .on("click", () => { });
    }

    addDragListener() {
        /*
        Handles the click and drag functionality which should activate on mousedown over a node, 
        and connect two nodes with an edge if mouseup occurs while over a second node.
        */
        var tthis = this;
        this.layer1.selectAll(".nodes")
            .on("mousedown", (e, d) => {
                this.svg.on(".zoom", null);
                this.svg.on("click", null);

                d.fx = d.x;
                d.fy = d.y;

                let [x, y] = d3.pointer(e);

                this.currentSource = d;
                this.tmpLine = this.layer2.append("line")
                    // .attr("class", "links")
                    .attr("x1", this.currentSource.x)
                    .attr("y1", this.currentSource.y)
                    .attr("x2", x)
                    .attr("y2", y)
                    .attr("stroke", "black")
                    .attr("transform", this.zoomLevel);
            })
            .on("mouseover", function (e, d) {
                if (tthis.currentSource) {
                    tthis.currentTarget = d;
                    d3.select(this).attr("fill", "red")
                        .attr("r", 10);
                }
                else {
                    d3.select(this).classed("node-highlight", true);
                    d3.selectAll(".links").filter(e => e.source.id === d.id || e.target.id === d.id)
                        .classed("link-highlight", true);
                    d3.selectAll(".arcs").filter(e => e.source.id === d.id || e.target.id === d.id)
                        .classed("link-highlight", true);
                }
                document.getElementById("movie-poster").src = d.small_img_link;
                document.getElementById("movie-name").innerHTML = d.name;
                document.getElementById("movie-id").innerHTML = d.id;
                document.getElementById("movie-rank").innerHTML = d.rank;
                document.getElementById("release-year").innerHTML = d.year;
                document.getElementById("imdb-rating").innerHTML = d.imdb_rating;
                document.getElementById("total-duration").innerHTML = d.duration;
                document.getElementById("genre").innerHTML = d.genre;
                document.getElementById("director").innerHTML = d.director_name;

            })
            .on("mouseout", function () {
                d3.select(this).attr("fill", "lightblue").attr("r", 5).classed("node-highlight", false);
                d3.selectAll(".links").classed("link-highlight", false);
                d3.selectAll(".arcs").classed("link-highlight", false);
                tthis.currentTarget = null;
                document.getElementById("movie-name").innerHTML = null;
                document.getElementById("movie-id").innerHTML = null;
                document.getElementById("movie-rank").innerHTML = null;
                document.getElementById("release-year").innerHTML = null;
                document.getElementById("imdb-rating").innerHTML = null;
                document.getElementById("total-duration").innerHTML = null;
                document.getElementById("genre").innerHTML = null;
                document.getElementById("director").innerHTML = null;
            });

        this.svg.on("mousemove", e => {
            if (this.currentSource) {
                let [x, y] = d3.pointer(e);
                this.tmpLine
                    .attr("x2", x)
                    .attr("y2", y)
                    .attr("transform", this.zoomLevel)
            }
        });

        this.svg.on("mouseup", () => {
            this.layer2.selectAll("line").remove();

            if (this.currentTarget) {

                if (this.currentSource === this.currentTarget) {
                    alert("Self loops not allowed");
                    return;
                }

                let newEdge = { "source": this.currentSource, "target": this.currentTarget };
                this.edges.forEach(e => {
                    if (newEdge.source.id === e.source.id && newEdge.target.id === e.target.id) {
                        alert("edge already exists");
                        return;
                    } else if (newEdge.target.id === e.source.id && newEdge.source.id === e.target.id) {
                        alert("edge already exists");
                        return;
                    }
                });

                if (this.layout === "fda") {
                    this.currentSource.fx = null;
                    this.currentSource.fy = null;
                }

                this.edges.push(newEdge);
                d3.selectAll(".nodes").attr("fill", "lightblue").attr("r", 5);
                this.draw();
                setTimeout(() => this.addClickListener(), 200);
            }

            // this.rescale();
            this.currentSource = null;
            this.currentTarget = null;
        })
    }


    linearLayout(field) {
        /*
        Computes a linear layout with respect to the (scalar valued) field parameter, which every node in the graph should have. 
        Currently, only defined for rank and year. 
        Makes use of d3.scale to adjust the x coordinates, and sets the y coordinate to height / 3 (To allow plenty of rooms for arcs underneath).
        If two nodes share a x coordinate, we use d3.forceCollision to force one of the nodes upwards (could be done more sophisticated, but we already build the class-wide simulation).
        */
        this.layout = "linear";
        this.sim.stop();

        let y = this.height / 3;
        let xextent = d3.extent(this.nodes, d => Number(d[field]))
        let xscale = d3.scaleLinear().domain(xextent).range([this.#margin.left, this.width - this.#margin.right]);

        this.layer1.selectAll(".links").remove();

        this.nodes.forEach(n => {
            n.x = n.fx = xscale(Number(n[field]));
            n.y = y;
        })


        this.draw();

        //Give enough time for the d3.transition() to take place (otherwise, jarring jump)
        setTimeout(() => {
            this.sim = d3.forceSimulation(this.nodes)
                .force("collide", d3.forceCollide(this.#nodeRadius))
                .force("y", d3.forceY(this.height / 2).strength(1e-2))

            this.startSim(y);
        }, 1000);

    }

    highlightNodes(subNodes) {
        /*
        Highlights the set of nodes subNodes, and makes all others transparent. 
        Future proofed for groups of nodes (now only called via search).
        */
        this.removeHighlight();

        this.layer1.selectAll(".links")
            .classed("link-unfocused", e => !subNodes.includes(e.source) && !subNodes.includes(e.target));

        this.layer1.selectAll(".nodes").filter(n => !subNodes.includes(n))
            .classed("node-unfocused", true)
            .attr("r", this.#nodeRadius);

        this.layer1.selectAll(".nodes").filter(n => subNodes.includes(n))
            .classed("node-focused", true)
            .attr("r", 2 * this.#nodeRadius);
    }

    removeHighlight() {
        /*
        Removes all highlights from above function.
        */
        this.layer1.selectAll(".links")
            .classed("link-unfocused", false);
        this.layer1.selectAll(".nodes")
            .classed("node-unfocused", false)
            .classed("node-focused", false)
            .attr("r", this.#nodeRadius);
    }

    putText(subNodes) {
        /*
        Enables text for highlighted nodes subNodes. 
        Future proofed for groups of nodes (now only called via search).
        */
        this.nodes.forEach(n =>
            n.showText = subNodes.includes(n) ? true : false
        );
        this.showText();
    }

    queryId(idx) {
        /*
        Finds and highlights nodes with id, title, or index idx.
        */
        const results = this.nodes.filter(node => (
            idx === node.rank ||
            idx === node.id ||
            idx === node.name ||
            idx === node.genre ||
            idx === node.cast_name ||
            idx === node.director_name ||
            idx === node.writter_name ||
            idx === node.title ||
            idx === node.index.toString()
        ));

        if (results.length > 0) {
            this.highlightNodes(results);
            this.putText(results);
        } else {
            this.removeHighlight();
            this.putText([]);
        }

        return results;
    }

    updateNodeAttributes(nodeId, attribute, newValue) {
        const selectedNode = this.nodes.find(node => node.id === nodeId);

        if (selectedNode) {
            // Check if the attribute exists in the node
            if (attribute in selectedNode) {
                selectedNode[attribute] = newValue;
                this.draw(); // Redraw the graph to reflect the changes
            } else {
                console.log("Attribute not found in the node.");
            }
        } else {
            console.log("Node not found with ID: " + nodeId);
        }
    }

    removeNode(nodeId) {
        // Find the node to remove by its ID
        const nodeIndex = this.nodes.findIndex(node => node.id === nodeId);

        if (nodeIndex !== -1) {
            // Remove the node from the nodes array
            this.nodes.splice(nodeIndex, 1);

            // Remove any edges that are connected to the removed node
            this.edges = this.edges.filter(edge => edge.source !== this.nodes[nodeIndex] && edge.target !== this.nodes[nodeIndex]);

            this.draw(); // Redraw the graph to reflect the changes
        }
    }

    removeEdge(sourceNodeId, targetNodeId) {
        // Find the edge to remove by the source and target nodes' IDs
        this.edges = this.edges.filter(edge => !(edge.source.id === sourceNodeId && edge.target.id === targetNodeId));

        this.draw(); // Redraw the graph to reflect the changes
    }


}