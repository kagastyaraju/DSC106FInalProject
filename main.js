// Set up dimensions
const margin = {top: 50, right: 150, bottom: 50, left: 70};
const width = 1000 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Create SVG container
const svg = d3.select("#timeSeriesChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Add a dropdown for subject selection
d3.select("#timeSeriesChart")
    .insert("div", "svg")
    .attr("class", "controls")
    .html(`
        <label for="subject-select">Select Subject: </label>
        <select id="subject-select">
            <option value="subj01">Subject 1</option>
            <option value="subj02">Subject 2</option>
            <option value="subj03">Subject 3</option>
            <option value="subj04">Subject 4</option>
            <option value="subj05">Subject 5</option>
            <option value="subj06">Subject 6</option>
            <option value="subj07">Subject 7</option>
            <option value="subj08">Subject 8</option>
            <option value="subj09">Subject 9</option>
            <option value="subj10">Subject 10</option>
        </select>
        <div class="legend">
            <div><span style="background-color: #2196F3"></span> Right MCA Blood Flow Velocity</div>
            <div><span style="background-color: #4CAF50"></span> Left MCA Blood Flow Velocity</div>
            <div><span style="background-color: #F44336"></span> Blood Pressure</div>
        </div>
    `);

// Add a tooltip div
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Function to load and visualize data
function loadAndVisualizeData(subjectFile) {
    // Clear previous visualization
    svg.selectAll("*").remove();
    
    // Show loading message
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .text("Loading data...");
    
    // Load the CSV file
    d3.text(`${subjectFile}.csv`).then(function(csvText) {
        // Remove the loading message
        svg.selectAll("*").remove();
        
        // Parse the CSV manually
        const lines = csvText.trim().split('\n');
        const processedData = [];
        
        for (let i = 0; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= 53) { // Ensure all 53 columns are present
                const dataPoint = {
                    right_MCA_BFV: parseFloat(values[0]),
                    left_MCA_BFV: parseFloat(values[1]),
                    Blood_pressure: parseFloat(values[2]),
                    Time: parseFloat(values[52]) // Column 53 (0-based index 52)
                };
                
                if (!isNaN(dataPoint.Time) && 
                    !isNaN(dataPoint.right_MCA_BFV) && 
                    !isNaN(dataPoint.left_MCA_BFV) && 
                    !isNaN(dataPoint.Blood_pressure)) {
                    processedData.push(dataPoint);
                }
            }
        }
        
        // Sort data by time
        processedData.sort((a, b) => a.Time - b.Time);
        
        // Create scales
        const xScale = d3.scaleLinear()
            .domain(d3.extent(processedData, d => d.Time))
            .range([0, width]);

        const maxBFV = Math.max(
            d3.max(processedData, d => d.right_MCA_BFV),
            d3.max(processedData, d => d.left_MCA_BFV)
        );
        const yScaleBFV = d3.scaleLinear()
            .domain([0, maxBFV * 1.1])
            .range([height, 0]);

        const yScaleBP = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => d.Blood_pressure) * 1.1])
            .range([height, 0]);

        // Create axes
        const xAxis = d3.axisBottom(xScale);
        const yAxisBFV = d3.axisLeft(yScaleBFV);
        const yAxisBP = d3.axisRight(yScaleBP);

        // Add X axis with label
        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .append("text")
            .attr("class", "axis-label")
            .attr("x", width / 2)
            .attr("y", 40)
            .style("text-anchor", "middle")
            .style("fill", "black")
            .style("font-size", "14px")
            .text("Time (seconds)");

        // Add Y axis for Blood Flow Velocity with label
        svg.append("g")
            .attr("class", "y-axis")
            .call(yAxisBFV)
            .append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", -60)
            .attr("x", -height / 2)
            .style("text-anchor", "middle")
            .style("fill", "black")
            .style("font-size", "14px")
            .text("Blood Flow Velocity (cm/s)");

        // Add Y axis for Blood Pressure with label
        svg.append("g")
            .attr("class", "y-axis-bp")
            .attr("transform", `translate(${width}, 0)`)
            .call(yAxisBP)
            .append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", 50)
            .attr("x", -height / 2)
            .style("text-anchor", "middle")
            .style("fill", "black")
            .style("font-size", "14px")
            .text("Blood Pressure (mmHg)");

        // Create line generators
        const rightBFVLine = d3.line()
            .x(d => xScale(d.Time))
            .y(d => yScaleBFV(d.right_MCA_BFV));

        const leftBFVLine = d3.line()
            .x(d => xScale(d.Time))
            .y(d => yScaleBFV(d.left_MCA_BFV));

        const bpLine = d3.line()
            .x(d => xScale(d.Time))
            .y(d => yScaleBP(d.Blood_pressure));

        // Add the right MCA BFV line
        svg.append("path")
            .datum(processedData)
            .attr("class", "line")
            .attr("d", rightBFVLine)
            .style("stroke", "#2196F3")
            .style("fill", "none")
            .style("stroke-width", 2);

        // Add the left MCA BFV line
        svg.append("path")
            .datum(processedData)
            .attr("class", "line")
            .attr("d", leftBFVLine)
            .style("stroke", "#4CAF50")
            .style("fill", "none")
            .style("stroke-width", 2);

        // Add the Blood Pressure line
        svg.append("path")
            .datum(processedData)
            .attr("class", "line")
            .attr("d", bpLine)
            .style("stroke", "#F44336")
            .style("fill", "none")
            .style("stroke-width", 2);

        // Optional: Load and add marker lines
        d3.text(`${subjectFile}.marker.csv`).then(function(markerText) {
            const markerTimes = markerText.trim().split('\n').map(line => parseFloat(line.split(',')[0]));
            markerTimes.forEach(time => {
                if (!isNaN(time)) {
                    svg.append("line")
                        .attr("x1", xScale(time))
                        .attr("x2", xScale(time))
                        .attr("y1", 0)
                        .attr("y2", height)
                        .style("stroke", "gray")
                        .style("stroke-width", 1)
                        .style("stroke-dasharray", "5,5");
                }
            });
        }).catch(error => console.log("Error loading markers:", error));

        // Add interactive elements - vertical line and points
        const verticalLine = svg.append("line")
            .attr("class", "vertical-line")
            .attr("y1", 0)
            .attr("y2", height)
            .style("opacity", 0)
            .style("stroke", "black")
            .style("stroke-width", 1)
            .style("stroke-dasharray", "3,3");

        const rightPoint = svg.append("circle")
            .attr("class", "point")
            .attr("r", 5)
            .style("opacity", 0)
            .style("fill", "#2196F3");

        const leftPoint = svg.append("circle")
            .attr("class", "point")
            .attr("r", 5)
            .style("opacity", 0)
            .style("fill", "#4CAF50");

        const bpPoint = svg.append("circle")
            .attr("class", "point")
            .attr("r", 5)
            .style("opacity", 0)
            .style("fill", "#F44336");

        // Add overlay for mouse interaction
        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .style("opacity", 0)
            .on("mousemove", function(event) {
                const [mouseX] = d3.pointer(event);
                const x0 = xScale.invert(mouseX);
                
                // Find the closest data point
                const bisect = d3.bisector(d => d.Time).left;
                const i = bisect(processedData, x0);
                const d0 = processedData[i - 1];
                const d1 = processedData[i];
                const d = x0 - (d0?.Time || Infinity) > (d1?.Time || -Infinity) - x0 ? d1 : d0;
                
                if (!d) return;
                
                // Update vertical line
                verticalLine
                    .attr("x1", xScale(d.Time))
                    .attr("x2", xScale(d.Time))
                    .style("opacity", 1);
                
                // Update points
                rightPoint
                    .attr("cx", xScale(d.Time))
                    .attr("cy", yScaleBFV(d.right_MCA_BFV))
                    .style("opacity", 1);
                
                leftPoint
                    .attr("cx", xScale(d.Time))
                    .attr("cy", yScaleBFV(d.left_MCA_BFV))
                    .style("opacity", 1);
                
                bpPoint
                    .attr("cx", xScale(d.Time))
                    .attr("cy", yScaleBP(d.Blood_pressure))
                    .style("opacity", 1);
                
                // Show tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                
                tooltip.html(`
                    <strong>Time:</strong> ${d.Time.toFixed(2)}s<br/>
                    <strong>Right MCA BFV:</strong> ${d.right_MCA_BFV.toFixed(2)} cm/s<br/>
                    <strong>Left MCA BFV:</strong> ${d.left_MCA_BFV.toFixed(2)} cm/s<br/>
                    <strong>Blood Pressure:</strong> ${d.Blood_pressure.toFixed(2)} mmHg
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                verticalLine.style("opacity", 0);
                rightPoint.style("opacity", 0);
                leftPoint.style("opacity", 0);
                bpPoint.style("opacity", 0);
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // Add title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(`Physiological Response Data - ${subjectFile}`);
    }).catch(function(error) {
        console.log("Error loading the data:", error);
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .text(`Error loading data for ${subjectFile}. Please check console for details.`);
    });
}

// Add event listener for subject selection
d3.select("#subject-select").on("change", function() {
    const selectedSubject = d3.select(this).property("value");
    loadAndVisualizeData(selectedSubject);
});

// Load initial data
loadAndVisualizeData("subj01");