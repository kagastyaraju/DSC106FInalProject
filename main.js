// Chart dimensions
const margin = { top: 20, right: 80, bottom: 50, left: 50 };
const width = 960 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Load and parse the CSV
d3.csv("combined_data.csv", d => {
    for (let key in d) {
        if (key !== "Subject" && key !== "Phase" && !key.startsWith("Unnamed")) {
            d[key] = +d[key]; // Convert to number
        }
    }
    return d;
}).then(data => {
    // Clean data by removing Unnamed columns
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
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(phases);

    // Populate subject dropdown (all subjects)
    const subjectSelect = d3.select("#subject-select");
    subjectSelect.selectAll("option")
        .data(subjects)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => `Subject ${d.slice(-2)}`);

    // --- Time Series Explorer ---
    function updateTimeSeries(subject) {
        const svg = d3.select("#timeSeriesChart").html("")
            .append("svg").attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const subjectData = data.filter(d => d.Subject === subject).sort((a, b) => a.Time - b.Time);
        const x = d3.scaleLinear().domain(d3.extent(subjectData, d => d.Time)).range([0, width]);
        const y = d3.scaleLinear().domain([0, d3.max(subjectData, d => Math.max(d.Blood_pressure, d.right_MCA_BFV, d.left_MCA_BFV, d.resp_uncalibrated))]).range([height, 0]);

        const lines = [
            { key: "Blood_pressure", color: "#e74c3c", id: "bp-check" },
            { key: "right_MCA_BFV", color: "#3498db", id: "rbfv-check" },
            { key: "left_MCA_BFV", color: "#2980b9", id: "lbfv-check" },
            { key: "resp_uncalibrated", color: "#2ecc71", id: "resp-check" }
        ];

        lines.forEach(line => {
            if (d3.select(`#${line.id}`).property("checked")) {
                svg.append("path")
                    .datum(subjectData)
                    .attr("fill", "none")
                    .attr("stroke", line.color)
                    .attr("stroke-width", 2)
                    .attr("d", d3.line().x(d => x(d.Time)).y(d => y(d[line.key])));
            }
        });

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d => d / 60)).append("text").attr("x", width / 2).attr("y", 40).attr("fill", "#000").attr("text-anchor", "middle").text("Time (minutes)");
        svg.append("g").call(d3.axisLeft(y)).append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -40).attr("fill", "#000").attr("text-anchor", "middle").text("Value");
    }

    // --- Phase-Specific Summary Dashboard ---
    function updatePhaseSummary(subject, phase) {
        const svg = d3.select("#phaseSummaryChart").html("")
            .append("svg").attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const subjectData = data.filter(d => d.Subject === subject && d.Phase === phase);
        const averages = measurements.map(m => ({ key: m, value: d3.mean(subjectData, d => d[m]) }));

        const x = d3.scaleBand().domain(measurements).range([0, width]).padding(0.1);
        const y = d3.scaleLinear().domain([0, d3.max(averages, d => d.value)]).range([height, 0]);

        svg.selectAll(".bar").data(averages).enter().append("rect")
            .attr("x", d => x(d.key)).attr("y", d => y(d.value))
            .attr("width", x.bandwidth()).attr("height", d => height - y(d.value))
            .attr("fill", "#3498db");

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        svg.append("g").call(d3.axisLeft(y));
    }

    // --- Correlation Explorer ---
    function updateCorrelation(subject, var1, var2) {
        const svg = d3.select("#correlationChart").html("")
            .append("svg").attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const subjectData = data.filter(d => d.Subject === subject);
        const x = d3.scaleLinear().domain(d3.extent(subjectData, d => d[var1])).range([0, width]);
        const y = d3.scaleLinear().domain(d3.extent(subjectData, d => d[var2])).range([height, 0]);

        svg.selectAll(".dot").data(subjectData).enter().append("circle")
            .attr("cx", d => x(d[var1])).attr("cy", d => y(d[var2]))
            .attr("r", 3).attr("fill", "#e74c3c");

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).append("text").attr("x", width / 2).attr("y", 40).attr("fill", "#000").attr("text-anchor", "middle").text(var1);
        svg.append("g").call(d3.axisLeft(y)).append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -40).attr("fill", "#000").attr("text-anchor", "middle").text(var2);
    }

    // --- Brain Oxygenation Heatmap ---
    function updateOxygenation(subject, timeIndex) {
        const svg = d3.select("#brainOxygenationChart").html("")
            .append("svg").attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const subjectData = data.filter(d => d.Subject === subject).sort((a, b) => a.Time - b.Time);
        const oxyData = subjectData.map(d => ({ Time: d.Time, Oxy: (d.i1_850 + d.i1_805) / 2 })); // Simplified oxygenation proxy
        const maxIndex = Math.min(timeIndex, oxyData.length - 1);

        const x = d3.scaleLinear().domain(d3.extent(oxyData, d => d.Time)).range([0, width]);
        const y = d3.scaleLinear().domain(d3.extent(oxyData, d => d.Oxy)).range([height, 0]);

        svg.append("path").datum(oxyData).attr("fill", "none").attr("stroke", "#2ecc71").attr("stroke-width", 2)
            .attr("d", d3.line().x(d => x(d.Time)).y(d => y(d.Oxy)));
        svg.append("circle").attr("cx", x(oxyData[maxIndex].Time)).attr("cy", y(oxyData[maxIndex].Oxy)).attr("r", 5).attr("fill", "#e74c3c");

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d => d / 60));
        svg.append("g").call(d3.axisLeft(y));
    }

    // --- Animated Physiological Journey ---
    let animationInterval;
    function updateAnimatedJourney(subject) {
        const svg = d3.select("#animatedJourneyChart").html("")
            .append("svg").attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const subjectData = data.filter(d => d.Subject === subject).sort((a, b) => a.Time - b.Time);
        const x = d3.scaleLinear().domain(d3.extent(subjectData, d => d.Time)).range([0, width]);
        const y = d3.scaleLinear().domain(d3.extent(subjectData, d => d.Blood_pressure)).range([height, 0]);

        svg.append("path").datum(subjectData).attr("fill", "none").attr("stroke", "#e74c3c").attr("stroke-width", 2)
            .attr("d", d3.line().x(d => x(d.Time)).y(d => y(d.Blood_pressure)));
        const cursor = svg.append("circle").attr("r", 5).attr("fill", "#3498db");
        let i = 0;

        function animate() {
            cursor.attr("cx", x(subjectData[i].Time)).attr("cy", y(subjectData[i].Blood_pressure));
            d3.select("#journey-text").text(`Time: ${(subjectData[i].Time / 60).toFixed(1)} min, BP: ${subjectData[i].Blood_pressure.toFixed(1)} mmHg, Phase: ${subjectData[i].Phase}`);
            i = (i + 1) % subjectData.length;
        }

        d3.select("#play-btn").on("click", () => { if (!animationInterval) animationInterval = setInterval(animate, 50); });
        d3.select("#pause-btn").on("click", () => { clearInterval(animationInterval); animationInterval = null; });
    }

    // --- Personalized Prediction Tool ---
    function updatePrediction(height, weight) {
        const svg = d3.select("#predictionChart").html("")
            .append("svg").attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const bmi = weight / ((height / 100) ** 2);
        const predictedBP = 90 + (bmi - 25) * 2; // Simple mock model

        const x = d3.scaleBand().domain(["Predicted BP"]).range([0, width]).padding(0.1);
        const y = d3.scaleLinear().domain([0, 150]).range([height, 0]);

        svg.append("rect").attr("x", x("Predicted BP")).attr("y", y(predictedBP))
            .attr("width", x.bandwidth()).attr("height", height - y(predictedBP)).attr("fill", "#3498db");
        svg.append("text").attr("x", width / 2).attr("y", y(predictedBP) - 10).attr("text-anchor", "middle").text(`${predictedBP.toFixed(1)} mmHg`);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        svg.append("g").call(d3.axisLeft(y));
    }

    // --- Gamified Quiz ---
    function setupQuiz() {
        d3.select("#quiz-up").on("click", () => d3.select("#quizResult").text("Correct! BFV increases to keep your brain supplied."));
        d3.select("#quiz-down").on("click", () => d3.select("#quizResult").text("Not quite. BFV usually rises to compensate."));
        d3.select("#quiz-steady").on("click", () => d3.select("#quizResult").text("Nope! BFV adjusts dynamically."));
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

    // Initialize everything
    let currentSubject = subjects[0];
    updateTimeSeries(currentSubject);
    updatePhaseSummary(currentSubject, "Resting");
    updateCorrelation(currentSubject, "Blood_pressure", "right_MCA_BFV");
    updateOxygenation(currentSubject, 0);
    updateAnimatedJourney(currentSubject);
    setupQuiz();
    setupScrollytelling();

    // Event listeners
    d3.select("#subject-select").on("change", () => {
        currentSubject = d3.event.target.value;
        updateTimeSeries(currentSubject);
        updatePhaseSummary(currentSubject, d3.select(".phase-btn.active").text() === "Rest" ? "Resting" : d3.select(".phase-btn.active").text() === "Stand-Up" ? "Standing" : "Sitting");
        updateCorrelation(currentSubject, d3.select("#var1-select").property("value"), d3.select("#var2-select").property("value"));
        updateOxygenation(currentSubject, +d3.select("#oxygen-slider").property("value"));
        updateAnimatedJourney(currentSubject);
    });

    measurements.forEach(m => d3.select(`#${m.split("_")[0].toLowerCase() + (m.includes("right") ? "r" : m.includes("left") ? "l" : "")}bfv-check`)?.on("change", () => updateTimeSeries(currentSubject)));
    d3.select("#resp-check").on("change", () => updateTimeSeries(currentSubject));

    d3.selectAll(".phase-btn").on("click", function() {
        d3.selectAll(".phase-btn").classed("active", false);
        d3.select(this).classed("active", true);
        updatePhaseSummary(currentSubject, this.textContent === "Rest" ? "Resting" : this.textContent === "Stand-Up" ? "Standing" : "Sitting");
    });

    d3.select("#var1-select").on("change", () => updateCorrelation(currentSubject, d3.select("#var1-select").property("value"), d3.select("#var2-select").property("value")));
    d3.select("#var2-select").on("change", () => updateCorrelation(currentSubject, d3.select("#var1-select").property("value"), d3.select("#var2-select").property("value")));

    d3.select("#oxygen-slider").attr("max", data.filter(d => d.Subject === currentSubject).length - 1)
        .on("input", () => updateOxygenation(currentSubject, +d3.event.target.value));

    d3.select("#prediction-form").on("submit", event => {
        event.preventDefault();
        const height = +d3.select("#height").property("value");
        const weight = +d3.select("#weight").property("value");
        updatePrediction(height, weight);
    });
});