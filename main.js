// Chart dimensions
const margin = { top: 20, right: 80, bottom: 50, left: 50 };
const width = 960 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Global variables for user profile and current subject
let userBP = null;
let userHR = null;
let currentSubject = null;

d3.csv("combined_data.csv", d => {
  for (let key in d) {
    if (key !== "Subject" && key !== "Phase" && !key.startsWith("Unnamed")) {
      d[key] = +d[key]; // Convert numeric values
    }
  }
  return d;
}).then(data => {
  // Remove any Unnamed columns
  data = data.map(d => {
    const cleaned = {};
    for (let key in d) {
      if (!key.startsWith("Unnamed")) cleaned[key] = d[key];
    }
    return cleaned;
  });

  // Extract unique subjects and measurements
  const subjects = [...new Set(data.map(d => d.Subject))];
  const measurements = ["Blood_pressure", "right_MCA_BFV", "left_MCA_BFV", "resp_uncalibrated"];
  const phases = ["Resting", "Preparing", "Standing", "Sitting"];
  currentSubject = subjects[0];

  // Populate subject dropdown
  const subjectSelect = d3.select("#subject-select");
  subjectSelect.selectAll("option")
    .data(subjects)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => `Subject ${d.slice(-2)}`);

  // Attach event listener for subject selection
  d3.select("#subject-select").on("change", function () {
    currentSubject = this.value;
    updateTimeSeries(currentSubject);
    updatePhaseSummary(currentSubject, d3.select(".phase-btn.active").text() === "Rest" ? "Resting" : d3.select(".phase-btn.active").text() === "Stand-Up" ? "Standing" : "Sitting");
    updateCorrelation(currentSubject, d3.select("#var1-select").property("value"), d3.select("#var2-select").property("value"));
    updateOxygenation(currentSubject, +d3.select("#oxygen-slider").property("value"));
    updateAnimatedJourney(currentSubject);
    updateUserProfile();
  });

  // Handle user profile form submission
  d3.select("#profile-form").on("submit", function(event) {
    event.preventDefault();
    userBP = +d3.select("#user-bp").property("value");
    userHR = +d3.select("#user-hr").property("value");
    updateUserProfile();
    updateTimeSeries(currentSubject);
  });

  // --- Interactive Time Series Explorer ---
  function updateTimeSeries(subject) {
    const svg = d3.select("#timeSeriesChart").html("")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const subjectData = data.filter(d => d.Subject === subject).sort((a, b) => a.Time - b.Time);
    const x = d3.scaleLinear().domain(d3.extent(subjectData, d => d.Time)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(subjectData, d => Math.max(d.Blood_pressure, d.right_MCA_BFV, d.left_MCA_BFV, d.resp_uncalibrated))]).range([height, 0]);

    // Define phase boundaries based on the data
    const phaseTransitions = {
      restToStand: subjectData.find(d => d.Phase === "Standing")?.Time || (x.domain()[0] + (x.domain()[1] - x.domain()[0]) * 0.4),
      standToSit: subjectData.find(d => d.Phase === "Sitting")?.Time || (x.domain()[0] + (x.domain()[1] - x.domain()[0]) * 0.7)
    };

    // Define the phases with actual time values
    const phases = [
      { name: "Rest Phase", start: x.domain()[0], end: phaseTransitions.restToStand, color: "rgba(200, 230, 200, 0.3)" },
      { name: "Stand-Up Phase", start: phaseTransitions.restToStand, end: phaseTransitions.standToSit, color: "rgba(230, 200, 200, 0.3)" },
      { name: "Sit-Down Phase", start: phaseTransitions.standToSit, end: x.domain()[1], color: "rgba(200, 200, 230, 0.3)" }
    ];

    // Add background highlights for each phase
    phases.forEach(phase => {
      svg.append('rect')
        .attr('x', x(phase.start))
        .attr('y', 0)
        .attr('width', x(phase.end) - x(phase.start))
        .attr('height', height)
        .attr('fill', phase.color)
        .attr('class', 'phase-highlight');
    });
    
    // Remove the phase labels from the top of the chart
    // (We'll add them to the legend instead)

    // Create ticks at 5-minute intervals (300 seconds) and ensure final tick is the domain end
    const tickInterval = 300;
    const domainStart = x.domain()[0];
    const domainEnd = x.domain()[1];
    const tickStart = Math.ceil(domainStart / tickInterval) * tickInterval;
    let tickValues = d3.range(tickStart, domainEnd, tickInterval);
    tickValues.push(domainEnd);

    // Define lines to plot with corresponding checkbox IDs
    const lines = [
        { key: "Blood_pressure", color: "#e74c3c", id: "bp-check", label: "Blood Pressure"},
        { key: "right_MCA_BFV", color: "#3498db", id: "rbfv-check", label: "Right Brain Blood Flow"},
        { key: "left_MCA_BFV", color: "#c842f5", id: "lbfv-check", label: "Left Brain Blood Flow"},
        { key: "resp_uncalibrated", color: "#2ecc71", id: "resp-check", label: "Respiratory Pattern"}
      ];

    // For each variable, check if its checkbox is checked before drawing its line
    lines.forEach(line => {
      if (d3.select(`#${line.id}`).property("checked")) {
        svg.append("path")
          .datum(subjectData)
          .attr("fill", "none")
          .attr("stroke", line.color)
          .attr("stroke-width", 2)
          .attr("opacity", 0.8)
          .attr("d", d3.line().x(d => x(d.Time)).y(d => y(d[line.key])));
      }
    });

    // Add vertical lines at phase transitions but without text labels
    svg.append('line')
      .attr('x1', x(phaseTransitions.restToStand))
      .attr('x2', x(phaseTransitions.restToStand))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5');
    
    svg.append('line')
      .attr('x1', x(phaseTransitions.standToSit))
      .attr('x2', x(phaseTransitions.standToSit))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#3498db')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5');

    // Draw x axis with tick labels in minutes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x)
        .tickValues(tickValues)
        .tickFormat(d => d / 60))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Time (minutes)");

    // Draw y axis
    svg.append("g")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text("Value");

    // Create a unified legend container positioned further to the right
    const legendContainer = svg.append('g')
      .attr('transform', `translate(${width + 20}, 10)`);
    
    // Add measurement legend
    const measurementLegend = legendContainer.append('g');
    
    // Add title for measurements
    measurementLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-weight', 'bold')
      .style('font-size', '12px')
      .text('Measurements:');
    
    // Add measurement items to legend
    lines.forEach((line, i) => {
      const g = measurementLegend.append('g')
        .attr('transform', `translate(0, ${i * 20 + 15})`);
      
      g.append('line')
        .attr('x1', 0)
        .attr('x2', 15)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', line.color)
        .attr('stroke-width', 2);
      
      g.append('text')
        .attr('x', 20)
        .attr('y', 4)
        .style('font-size', '11px')
        .text(line.label);
    });
    
    // Add phase legend below measurement legend
    const phaseLegend = legendContainer.append('g')
      .attr('transform', `translate(0, ${lines.length * 20 + 30})`);
    
    phaseLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-weight', 'bold')
      .style('font-size', '12px')
      .text('Phases:');
    
    // Add phase items to legend
    phases.forEach((phase, i) => {
      const g = phaseLegend.append('g')
        .attr('transform', `translate(0, ${i * 20 + 15})`);
      
      g.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', phase.color)
        .attr('stroke', '#999')
        .attr('stroke-width', 0.5);
      
      g.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .style('font-size', '11px')
        .text(phase.name);
    });
    
    // Add transition markers to legend
    const transitionLegend = legendContainer.append('g')
      .attr('transform', `translate(0, ${lines.length * 20 + phases.length * 20 + 60})`);
    
    transitionLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-weight', 'bold')
      .style('font-size', '12px')
      .text('Transitions:');
    
    // Stand Up transition
    const standUpG = transitionLegend.append('g')
      .attr('transform', 'translate(0, 15)');
    
    standUpG.append('line')
      .attr('x1', 0)
      .attr('x2', 15)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5');
    
    standUpG.append('text')
      .attr('x', 20)
      .attr('y', 4)
      .style('font-size', '11px')
      .text('Stand Up');
    
    // Sit Down transition
    const sitDownG = transitionLegend.append('g')
      .attr('transform', 'translate(0, 35)');
    
    sitDownG.append('line')
      .attr('x1', 0)
      .attr('x2', 15)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#3498db')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5');
    
    sitDownG.append('text')
      .attr('x', 20)
      .attr('y', 4)
      .style('font-size', '11px')
      .text('Sit Down');

    // Overlay user's resting blood pressure if provided
    if (userBP !== null) {
      svg.append("line")
        .attr("x1", 0)
        .attr("y1", y(userBP))
        .attr("x2", width)
        .attr("y2", y(userBP))
        .attr("stroke", "purple")
        .attr("stroke-width", 2)
        .style("stroke-dasharray", ("3, 3"));

      svg.append("text")
        .attr("x", width - 100)
        .attr("y", y(userBP) - 10)
        .attr("fill", "purple")
        .text("Your Resting BP");
    }

    d3.select("#ts-annotation").html(`
      <p><strong>What You're Seeing:</strong> This graph shows how your body responds to standing up and sitting down. 
      When you stand, notice how blood pressure initially dips, followed by a compensatory increase in brain blood flow. 
      This brief delay reveals the critical moments when your body works to maintain brain perfusion despite gravity's challenge.</p>
    `);
  }

  // --- Phase-Specific Summary Dashboard ---
  function updatePhaseSummary(subject, phase) {
    const svg = d3.select("#phaseSummaryChart").html("")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const subjectData = data.filter(d => d.Subject === subject && d.Phase === phase);
    const averages = measurements.map(m => ({ key: m, value: d3.mean(subjectData, d => d[m]) }));

    const x = d3.scaleBand().domain(measurements).range([0, width]).padding(0.1);
    // Set a fixed y-axis scale with maximum value of 65
    const yScale = d3.scaleLinear().domain([0, 180]).range([height, 0]);

    svg.selectAll(".bar")
      .data(averages)
      .enter()
      .append("rect")
      .attr("x", d => x(d.key))
      .attr("y", d => yScale(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => height - yScale(d.value))
      .attr("fill", "#3498db");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(yScale));
  }

  // --- Correlation Explorer ---
  function updateCorrelation(subject, var1, var2) {
    const svg = d3.select("#correlationChart").html("")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const subjectData = data.filter(d => d.Subject === subject);
    const x = d3.scaleLinear().domain(d3.extent(subjectData, d => d[var1])).range([0, width]);
    const y = d3.scaleLinear().domain(d3.extent(subjectData, d => d[var2])).range([height, 0]);

    svg.selectAll(".dot")
      .data(subjectData)
      .enter()
      .append("circle")
      .attr("cx", d => x(d[var1]))
      .attr("cy", d => y(d[var2]))
      .attr("r", 3)
      .attr("fill", "#e74c3c");

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text(var1);

    svg.append("g")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text(var2);
  }

  // --- Brain Oxygenation Heatmap ---
  function updateOxygenation(subject, timeIndex) {
    const svg = d3.select("#brainOxygenationChart").html("")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const subjectData = data.filter(d => d.Subject === subject).sort((a, b) => a.Time - b.Time);
    const oxyData = subjectData.map(d => ({ Time: d.Time, Oxy: (d.i1_850 + d.i1_805) / 2 }));
    const maxIndex = Math.min(timeIndex, oxyData.length - 1);

    const x = d3.scaleLinear().domain(d3.extent(oxyData, d => d.Time)).range([0, width]);
    const y = d3.scaleLinear().domain(d3.extent(oxyData, d => d.Oxy)).range([height, 0]);

    svg.append("path")
      .datum(oxyData)
      .attr("fill", "none")
      .attr("stroke", "#2ecc71")
      .attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x(d.Time)).y(d => y(d.Oxy)));

    svg.append("circle")
      .attr("cx", x(oxyData[maxIndex].Time))
      .attr("cy", y(oxyData[maxIndex].Oxy))
      .attr("r", 5)
      .attr("fill", "#e74c3c");

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => d / 60));
    svg.append("g").call(d3.axisLeft(y));
  }

  // --- Animated Physiological Journey ---
  let animationInterval;
  function updateAnimatedJourney(subject) {
    const svg = d3.select("#animatedJourneyChart").html("")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const subjectData = data.filter(d => d.Subject === subject).sort((a, b) => a.Time - b.Time);
    const x = d3.scaleLinear().domain(d3.extent(subjectData, d => d.Time)).range([0, width]);
    const y = d3.scaleLinear().domain(d3.extent(subjectData, d => d.Blood_pressure)).range([height, 0]);

    svg.append("path")
      .datum(subjectData)
      .attr("fill", "none")
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x(d.Time)).y(d => y(d.Blood_pressure)));

    const cursor = svg.append("circle")
      .attr("r", 5)
      .attr("fill", "#3498db");

    let i = 0;
    function animate() {
      cursor.attr("cx", x(subjectData[i].Time))
        .attr("cy", y(subjectData[i].Blood_pressure));
      d3.select("#journey-text").text(
        `At ${(subjectData[i].Time / 60).toFixed(1)} min: BP = ${subjectData[i].Blood_pressure.toFixed(1)} mmHg, Phase: ${subjectData[i].Phase} – And your body initiates its response, but note the brief lag, therefore the adjustment is gradual.`
      );
      i = (i + 1) % subjectData.length;
    }

    d3.select("#play-btn").on("click", () => { 
      if (!animationInterval) animationInterval = setInterval(animate, 50); 
    });
    d3.select("#pause-btn").on("click", () => { 
      clearInterval(animationInterval); 
      animationInterval = null; 
    });
  }

  // --- Your Personal Profile ---
  function updateUserProfile() {
    const subjectData = data.filter(d => d.Subject === currentSubject && d.Phase === "Resting");
    const avgBP = d3.mean(subjectData, d => d.Blood_pressure);
    const svg = d3.select("#profileChart").html("")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const bars = [
      { label: "Dataset Avg BP", value: avgBP },
      { label: "Your Resting BP", value: userBP }
    ];
    const x = d3.scaleBand().domain(bars.map(d => d.label)).range([0, width]).padding(0.4);
    const yScale = d3.scaleLinear().domain([0, d3.max(bars, d => d.value)]).range([height, 0]);

    svg.selectAll(".bar")
      .data(bars)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.label))
      .attr("y", d => yScale(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => height - yScale(d.value))
      .attr("fill", d => d.label === "Your Resting BP" ? "#8e44ad" : "#3498db");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(yScale));

    svg.selectAll("text.label")
      .data(bars)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", d => x(d.label) + x.bandwidth() / 2)
      .attr("y", d => yScale(d.value) - 5)
      .attr("text-anchor", "middle")
      .text(d => d.value.toFixed(1) + " mmHg");
  }

  // --- Gamified Quiz ---
  function setupQuiz() {
    d3.select("#quiz-up").on("click", () => d3.select("#quizResult").text("Correct! As you stand, BFV increases to compensate."));
    d3.select("#quiz-down").on("click", () => d3.select("#quizResult").text("Not quite. BFV typically rises rather than drops."));
    d3.select("#quiz-steady").on("click", () => d3.select("#quizResult").text("Nope! The dynamic change is key."));
  }

  // --- Scrollytelling ---
  function setupScrollytelling() {
    const sections = d3.selectAll(".scroll-section");
    window.addEventListener("scroll", () => {
      const scrollPos = window.scrollY + window.innerHeight / 2;
      sections.each(function() {
        const section = d3.select(this);
        const top = this.offsetTop;
        const bottom = top + this.offsetHeight;
        section.classed("active", scrollPos >= top && scrollPos <= bottom);
      });
    });
  }

  // Attach event listeners for the four checkboxes explicitly
  d3.select("#bp-check").on("change", () => updateTimeSeries(currentSubject));
  d3.select("#rbfv-check").on("change", () => updateTimeSeries(currentSubject));
  d3.select("#lbfv-check").on("change", () => updateTimeSeries(currentSubject));
  d3.select("#resp-check").on("change", () => updateTimeSeries(currentSubject));

  // Listeners for other interactive elements
  d3.selectAll(".phase-btn").on("click", function() {
    d3.selectAll(".phase-btn").classed("active", false);
    d3.select(this).classed("active", true);
    updatePhaseSummary(currentSubject, this.textContent === "Rest" ? "Resting" : this.textContent === "Stand-Up" ? "Standing" : "Sitting");
  });

  d3.select("#var1-select").on("change", () => updateCorrelation(currentSubject, d3.select("#var1-select").property("value"), d3.select("#var2-select").property("value")));
  d3.select("#var2-select").on("change", () => updateCorrelation(currentSubject, d3.select("#var1-select").property("value"), d3.select("#var2-select").property("value")));

  d3.select("#oxygen-slider").attr("max", data.filter(d => d.Subject === currentSubject).length - 1)
    .on("input", () => updateOxygenation(currentSubject, +d3.select("#oxygen-slider").property("value")));

  // Initialize visualizations
  updateTimeSeries(currentSubject);
  updatePhaseSummary(currentSubject, "Resting");
  updateCorrelation(currentSubject, "Blood_pressure", "right_MCA_BFV");
  updateOxygenation(currentSubject, 0);
  updateAnimatedJourney(currentSubject);
  setupQuiz();
  setupScrollytelling();
});


// Time Series Chart
function initTimeSeriesChart() {
  const container = document.getElementById('timeSeriesChart');
  if (!container) return;
  
  // Clear previous chart
  container.innerHTML = '';
  
  // Set dimensions
  const margin = {top: 20, right: 30, bottom: 50, left: 60};
  const width = container.clientWidth - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Define the phases
  const phases = [
    { name: "Rest Phase", start: 0, end: 1860, color: "rgba(200, 230, 200, 0.3)" },
    { name: "Stand-Up Phase", start: 1860, end: 1920, color: "rgba(230, 200, 200, 0.3)" },
    { name: "Sit-Down Phase", start: 1920, end: 1980, color: "rgba(200, 200, 230, 0.3)" }
  ];
  
  // Expand the time range to show all phases
  const startTime = 1800; // Show a bit of rest phase
  const endTime = 1980;   // Show until end of sit-down phase
  
  const filteredData = sampleData.filter(d => d.time >= startTime && d.time <= endTime);
  
  // Create scales
  const x = d3.scaleLinear()
    .domain([startTime, endTime])
    .range([0, width]);
  
  // Find min and max values across all measures
  const allValues = filteredData.flatMap(d => [
    d.Blood_pressure, 
    d.right_MCA_BFV, 
    d.left_MCA_BFV, 
    d.Respiratory
  ]);
  
  const y = d3.scaleLinear()
    .domain([d3.min(allValues) * 0.9, d3.max(allValues) * 1.1])
    .range([height, 0]);
  
  // Add background highlights for each phase
  phases.forEach(phase => {
    if (phase.start >= startTime && phase.end <= endTime) {
      svg.append('rect')
        .attr('x', x(phase.start))
        .attr('y', 0)
        .attr('width', x(phase.end) - x(phase.start))
        .attr('height', height)
        .attr('fill', phase.color)
        .attr('class', 'phase-highlight');
      
      // Add phase label at the top
      svg.append('text')
        .attr('x', x(phase.start) + (x(phase.end) - x(phase.start)) / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#555')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(phase.name);
    }
  });
  
  // Add X axis
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d => `${d}s`))
    .append('text')
    .attr('x', width / 2)
    .attr('y', 40)
    .attr('fill', 'black')
    .attr('text-anchor', 'middle')
    .text('Time (seconds)');
  
  // Add Y axis
  svg.append('g')
    .call(d3.axisLeft(y))
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -40)
    .attr('x', -height / 2)
    .attr('fill', 'black')
    .attr('text-anchor', 'middle')
    .text('Value');
  
  // Add vertical lines at phase transitions
  svg.append('line')
    .attr('x1', x(1860))
    .attr('x2', x(1860))
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', 'red')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5');
  
  svg.append('text')
    .attr('x', x(1860) + 5)
    .attr('y', 30)
    .attr('fill', 'red')
    .text('Stand Up');
  
  svg.append('line')
    .attr('x1', x(1920))
    .attr('x2', x(1920))
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', 'blue')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5');
  
  svg.append('text')
    .attr('x', x(1920) + 5)
    .attr('y', 30)
    .attr('fill', 'blue')
    .text('Sit Down');
  
  // Create line generators
  const bpLine = d3.line()
    .x(d => x(d.time))
    .y(d => y(d.Blood_pressure))
    .curve(d3.curveMonotoneX);
  
  const rightBFVLine = d3.line()
    .x(d => x(d.time))
    .y(d => y(d.right_MCA_BFV))
    .curve(d3.curveMonotoneX);
  
  const leftBFVLine = d3.line()
    .x(d => x(d.time))
    .y(d => y(d.left_MCA_BFV))
    .curve(d3.curveMonotoneX);
  
  const respLine = d3.line()
    .x(d => x(d.time))
    .y(d => y(d.Respiratory))
    .curve(d3.curveMonotoneX);
  
  // Add lines
  const bpPath = svg.append('path')
    .datum(filteredData)
    .attr('fill', 'none')
    .attr('stroke', 'red')
    .attr('stroke-width', 2)
    .attr('d', bpLine)
    .attr('class', 'bp-line');
  
  const rightBFVPath = svg.append('path')
    .datum(filteredData)
    .attr('fill', 'none')
    .attr('stroke', 'blue')
    .attr('stroke-width', 2)
    .attr('d', rightBFVLine)
    .attr('class', 'rbfv-line');
  
  const leftBFVPath = svg.append('path')
    .datum(filteredData)
    .attr('fill', 'none')
    .attr('stroke', 'green')
    .attr('stroke-width', 2)
    .attr('d', leftBFVLine)
    .attr('class', 'lbfv-line');
  
  const respPath = svg.append('path')
    .datum(filteredData)
    .attr('fill', 'none')
    .attr('stroke', 'purple')
    .attr('stroke-width', 2)
    .attr('d', respLine)
    .attr('class', 'resp-line');
  
  // Handle checkbox changes
  document.getElementById('bp-check').addEventListener('change', function() {
    bpPath.style('display', this.checked ? 'block' : 'none');
  });
  
  document.getElementById('rbfv-check').addEventListener('change', function() {
    rightBFVPath.style('display', this.checked ? 'block' : 'none');
  });
  
  document.getElementById('lbfv-check').addEventListener('change', function() {
    leftBFVPath.style('display', this.checked ? 'block' : 'none');
  });
  
  document.getElementById('resp-check').addEventListener('change', function() {
    respPath.style('display', this.checked ? 'block' : 'none');
  });
  
  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 150}, 50)`);
  
  const legendItems = [
    { label: 'Blood Pressure', color: 'red' },
    { label: 'Right BFV', color: 'blue' },
    { label: 'Left BFV', color: 'green' },
    { label: 'Respiratory', color: 'purple' }
  ];
  
  legendItems.forEach((item, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    g.append('rect')
      .attr('width', 15)
      .attr('height', 2)
      .attr('fill', item.color);
    
    g.append('text')
      .attr('x', 20)
      .attr('y', 5)
      .text(item.label)
      .style('font-size', '12px');
  });
  
  // Add phase legend
  const phaseLegend = svg.append('g')
    .attr('transform', `translate(10, ${height + 30})`);
  
  phaseLegend.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .text('Phases:')
    .style('font-weight', 'bold');
  
  phases.forEach((phase, i) => {
    const g = phaseLegend.append('g')
      .attr('transform', `translate(${i * 150 + 60}, 0)`);
    
    g.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', phase.color);
    
    g.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .text(phase.name)
      .style('font-size', '12px');
  });
}
