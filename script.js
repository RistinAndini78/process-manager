
    /**********************
     * Global state
     **********************/
    let selectedAlgorithm = null; // 'FCFS' | 'SJF' | 'Priority' | 'RoundRobin'
    let processes = [];
    let simulationSteps = [];
    let currentStep = 0;
    let simInterval = null;

    /**********************
     * Init
     **********************/
    document.addEventListener('DOMContentLoaded', () => {
        initAlgorithmSelection();
        initFormHandlers();
        initSimulationControls();
        renderProcessList();
    });

    /**********************
     * Utilities & UI helpers
     **********************/
    function uid(){ return Date.now() + Math.floor(Math.random()*1000); }
    function showToast(msg, type='success'){
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast show' + (type==='error' ? ' error' : '');
        setTimeout(()=> t.classList.remove('show'), 3000);
    }
    function deepSnapshot(arr){
        return arr.map(p => ({ id:p.id, name:p.name, arrivalTime:p.arrivalTime, burstTime:p.burstTime, remainingTime:p.remainingTime, priority:p.priority, status:p.status }));
    }

    /**********************
     * Algorithm selection UI
     **********************/
    function initAlgorithmSelection(){
        const algoSelect = document.getElementById('algorithm-select');
        const lockBtn = document.getElementById('lock-algo-btn');
        const changeBtn = document.getElementById('change-algo-btn');
        const selectedLabel = document.getElementById('selected-algo-label');
        const rrQuantumContainer = document.getElementById('rr-quantum-container');

        // show/hide global quantum input when user changes the select (before locking)
        algoSelect.addEventListener('change', () => {
            if (algoSelect.value === 'RoundRobin') {
                rrQuantumContainer.classList.remove('hidden');
            } else {
                rrQuantumContainer.classList.add('hidden');
            }
        });

        lockBtn.addEventListener('click', () => {
            const val = algoSelect.value;
            if (!val) { showToast('Pilih algoritma terlebih dahulu', 'error'); return; }
            // set selected algorithm, hide selection and show form
            selectedAlgorithm = val;
            document.getElementById('algorithm-select-container').classList.add('hidden');
            document.getElementById('form-and-queue').classList.remove('hidden');
            document.getElementById('algo-name').textContent = labelForAlgo(val);
            selectedLabel.textContent = `Mode: ${labelForAlgo(val)}`;
            changeBtn.classList.remove('hidden');
            // update form fields according to selectedAlgorithm
            adaptFormFieldsByAlgorithm();

            // If RoundRobin selected, keep rrQuantumContainer visible in UI? We hide the global quantum input after lock,
            // but we still use its value. We'll hide it to indicate it's locked.
            if (selectedAlgorithm === 'RoundRobin') {
                // hide global quantum input (locked) but keep its value used by simulation
                rrQuantumContainer.classList.add('hidden');
                showToast(`Round Robin dipilih — Quantum = ${getGlobalQuantum()}s`);
            }
        });

        changeBtn.addEventListener('click', () => {
            // show selection again and clear any pending processes
            selectedAlgorithm = null;
            document.getElementById('algorithm-select-container').classList.remove('hidden');
            document.getElementById('form-and-queue').classList.add('hidden');
            document.getElementById('algorithm-select').value = '';
            document.getElementById('selected-algo-label').textContent = '';
            changeBtn.classList.add('hidden');
            processes = [];
            renderProcessList();
            // show rr quantum input hidden earlier
            rrQuantumContainer.classList.add('hidden');
            showToast('Mode penjadwalan dikembalikan. Pilih mode baru jika perlu.');
        });
    }

    function labelForAlgo(key){
        switch(key){
            case 'FCFS': return 'FCFS (First Come First Serve)';
            case 'SJF': return 'SJF (Shortest Job First)';
            case 'Priority': return 'Priority (Preemptive)';
            case 'RoundRobin': return 'Round Robin (RR)';
            default: return '-';
        }
    }

    function getGlobalQuantum(){
        const qInput = document.getElementById('global-quantum');
        const q = parseInt(qInput?.value);
        return (!isNaN(q) && q > 0) ? q : 2;
    }

    /**********************
     * Dynamic form handlers
     **********************/
    function initFormHandlers(){
        const form = document.getElementById('dynamic-process-form');
        document.getElementById('form-clear-btn').addEventListener('click', ()=> form.reset());

        form.addEventListener('submit', (e)=>{
            e.preventDefault();
            if (!selectedAlgorithm) { showToast('Pilih algoritma terlebih dahulu', 'error'); return; }
            addProcessFromForm();
        });
    }

    function adaptFormFieldsByAlgorithm(){
        // Show/hide fields depending on selectedAlgorithm
        const fArrival = document.getElementById('field-arrival');
        const fBurst = document.getElementById('field-burst');
        const fPriority = document.getElementById('field-priority');
        const fQuantum = document.getElementById('field-quantum');

        // default hide all, then enable specific ones
        fArrival.classList.add('hidden');
        fBurst.classList.remove('hidden');
        fPriority.classList.add('hidden');
        fQuantum.classList.add('hidden'); // ensure per-process quantum not used

        if (selectedAlgorithm === 'FCFS') {
            fArrival.classList.remove('hidden'); // FCFS needs arrival
        } else if (selectedAlgorithm === 'SJF') {
            fArrival.classList.remove('hidden'); // allow arrival input for SJF as well
        } else if (selectedAlgorithm === 'Priority') {
            fArrival.classList.remove('hidden');
            fPriority.classList.remove('hidden');
        } else if (selectedAlgorithm === 'RoundRobin') {
            fArrival.classList.remove('hidden');
            // DO NOT show per-process quantum; quantum is global (input moved to algorithm-select area)
        }
        // reset form fields to defaults for convenience
        document.getElementById('dynamic-process-form').reset();
        // we do not set per-process quantum
    }

    function addProcessFromForm(){
        const name = document.getElementById('form-process-name').value.trim();
        const burst = parseInt(document.getElementById('form-burst').value);
        const arrivalRaw = document.getElementById('form-arrival').value;
        const arrival = arrivalRaw === '' ? 0 : parseInt(arrivalRaw);
        const priority = parseInt(document.getElementById('form-priority').value) || 1;

        if (!name || !burst || isNaN(arrival)) {
            showToast('Mohon isi field yang diperlukan dengan benar', 'error');
            return;
        }

        // Important: process starts as 'New' and will move to 'Ready' when arrival time tercapai selama simulasi
        const p = {
            id: uid(),
            name,
            burstTime: burst,
            remainingTime: burst,
            arrivalTime: arrival,
            priority,
            status: 'New' // start as New
        };

        processes.push(p);
        renderProcessList();
        document.getElementById('dynamic-process-form').reset();
        showToast(`Proses ${name} ditambahkan`);
    }

    function renderProcessList(){
        const list = document.getElementById('process-list');
        const count = document.getElementById('process-count');
        count.textContent = processes.length;
        if (processes.length === 0) {
            list.innerHTML = `<div class="text-center py-12 text-slate-400">Belum ada proses. Tambahkan proses terlebih dahulu.</div>`;
            return;
        }
        const html = processes
            .slice().sort((a,b)=> a.arrivalTime - b.arrivalTime)
            .map(p => `
            <div class="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <div>
                    <div class="font-semibold">${p.name} <span class="text-xs text-slate-400">(${p.status})</span></div>
                    <div class="text-sm text-slate-400">Burst: ${p.burstTime}s • Arrival: ${p.arrivalTime}s • Priority: ${p.priority}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="removeProcess(${p.id})" class="text-red-400 px-2 py-1 rounded">Hapus</button>
                </div>
            </div>
        `).join('');
        list.innerHTML = html;
    }

    function removeProcess(id){
        processes = processes.filter(p => p.id !== id);
        renderProcessList();
        showToast('Proses dihapus');
    }

    /**********************
     * Simulation controls init
     **********************/
    function initSimulationControls(){
        document.getElementById('start-simulation-btn').addEventListener('click', startSimulation);
        document.getElementById('reset-btn').addEventListener('click', resetAll);
        document.getElementById('prev-step-btn').addEventListener('click', ()=> { if (currentStep>0) { currentStep--; renderStep(); }});
        document.getElementById('next-step-btn').addEventListener('click', ()=> { if (currentStep < simulationSteps.length-1) { currentStep++; renderStep(); }});
        document.getElementById('stop-sim-btn').addEventListener('click', ()=> { if (simInterval) { clearInterval(simInterval); simInterval = null; showToast('Auto-play dihentikan'); }});
    }

    function resetAll(){
        // Reset UI to initial: show algorithm select, hide form area & simulation area
        selectedAlgorithm = null;
        processes = [];
        simulationSteps = [];
        currentStep = 0;
        if (simInterval) { clearInterval(simInterval); simInterval = null; }
        document.getElementById('algorithm-select-container').classList.remove('hidden');
        document.getElementById('form-and-queue').classList.add('hidden');
        document.getElementById('simulation-area').classList.add('hidden');
        document.getElementById('change-algo-btn').classList.add('hidden');
        document.getElementById('selected-algo-label').textContent = '';
        document.getElementById('algorithm-select').value = '';
        // show global quantum input again (in case RR was selected before)
        document.getElementById('rr-quantum-container')?.classList.add('hidden');
        renderProcessList();
        showToast('Sistem di-reset. Pilih mode penjadwalan lagi.');
    }

    /**********************
     * Dispatcher: start simulation
     **********************/
    function startSimulation(){
        if (!selectedAlgorithm) { showToast('Pilih algoritma dulu', 'error'); return; }
        if (processes.length === 0) { showToast('Tambahkan minimal 1 proses', 'error'); return; }

        // Prepare working copy: ensure fresh objects and status 'New' (we already store New)
        const working = processes.map(p => ({ ...p, remainingTime: p.remainingTime ?? p.burstTime, status: 'New' }));
        let steps = [];
        if (selectedAlgorithm === 'FCFS') {
            steps = simulateFCFS(working);
        } else if (selectedAlgorithm === 'SJF') {
            steps = simulateSJF(working);
        } else if (selectedAlgorithm === 'Priority') {
            steps = simulatePriorityPreemptive(working);
        } else if (selectedAlgorithm === 'RoundRobin') {
            const q = getGlobalQuantum(); // use global quantum (one-time input)
            steps = simulateRoundRobin(working, q);
        }

        simulationSteps = steps || [];
        if (simulationSteps.length === 0) { showToast('Tidak ada langkah simulasi (cek input)', 'error'); return; }

        currentStep = 0;
        document.getElementById('simulation-area').classList.remove('hidden');
        document.getElementById('sim-algo-label').textContent = labelForAlgo(selectedAlgorithm);
        renderStep();
        showToast('Simulasi dimulai');
    }

    /**********************
     * Render step & dynamic table header
     **********************/
    function renderStep(){
        const step = simulationSteps[currentStep];
        if (!step) return;
        document.getElementById('step-counter').textContent = `Step ${currentStep+1} / ${simulationSteps.length}`;
        document.getElementById('current-time').textContent = step.time;
        document.getElementById('step-desc').textContent = step.description;

        // Build dynamic table header according to selectedAlgorithm
        const header = document.getElementById('table-header');
        const tbody = document.getElementById('process-table-body');

        // Columns per algorithm
        let headHtml = '<tr class="border-b border-slate-700">';
        headHtml += '<th class="text-left py-3 px-4 text-slate-300 font-semibold">Proses</th>';
        // Arrival column shown ONLY for FCFS (per request)
        if (selectedAlgorithm === 'FCFS') {
            headHtml += '<th class="text-left py-3 px-4 text-slate-300 font-semibold">Arrival</th>';
        }
        headHtml += '<th class="text-left py-3 px-4 text-slate-300 font-semibold">Burst</th>';
        if (selectedAlgorithm === 'SJF' || selectedAlgorithm === 'RoundRobin' || selectedAlgorithm === 'Priority') {
            headHtml += '<th class="text-left py-3 px-4 text-slate-300 font-semibold">Tersisa</th>';
        }
        if (selectedAlgorithm === 'Priority') {
            headHtml += '<th class="text-left py-3 px-4 text-slate-300 font-semibold">Priority</th>';
        }
        headHtml += '<th class="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>';
        headHtml += '</tr>';
        header.innerHTML = headHtml;

        // Rows
        const rows = step.processes
            .slice()
            .sort((a,b)=> a.name.localeCompare(b.name))
            .map(p => {
                let cols = `<td class="py-3 px-4 text-white font-medium">${p.name}</td>`;
                if (selectedAlgorithm === 'FCFS') {
                    cols += `<td class="py-3 px-4 text-slate-300">${p.arrivalTime ?? '-'}</td>`;
                }
                cols += `<td class="py-3 px-4 text-slate-300">${p.burstTime ?? '-'}s</td>`;
                if (selectedAlgorithm === 'SJF' || selectedAlgorithm === 'RoundRobin' || selectedAlgorithm === 'Priority') {
                    cols += `<td class="py-3 px-4 text-slate-300">${(p.remainingTime !== undefined ? p.remainingTime : '-') }s</td>`;
                }
                if (selectedAlgorithm === 'Priority') {
                    cols += `<td class="py-3 px-4 text-slate-300">${p.priority ?? '-'}</td>`;
                }
                cols += `<td class="py-3 px-4"><span class="px-3 py-1 rounded border ${statusClass(p.status)}">${p.status}</span></td>`;
                return `<tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">${cols}</tr>`;
            }).join('');
        tbody.innerHTML = rows;

        // Update navigation buttons
        document.getElementById('prev-step-btn').disabled = currentStep === 0;
        document.getElementById('next-step-btn').disabled = currentStep === simulationSteps.length - 1;
    }

    function statusClass(status){
        switch(status){
            case 'New': return 'bg-slate-700/20 text-slate-300 border-slate-600/50';
            case 'Ready': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
            case 'Running': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
            case 'Waiting': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
            case 'Terminated': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
        }
    }

    /**********************
     * Simulator implementations (all return steps array)
     **********************/
    // FCFS (non-preemptive) - uses arrival order; processes move New -> Ready when arrivalTime <= t
    function simulateFCFS(inputProcesses){
        const procs = inputProcesses.map(p=>({ ...p }));
        // sort by arrival time for FCFS order
        procs.sort((a,b)=> a.arrivalTime - b.arrivalTime);
        procs.forEach(p=>{ p.remainingTime = p.remainingTime ?? p.burstTime; p.status = 'New'; });
        let t = 0;
        const steps = [];
        steps.push({ time: t, description: 'Mulai FCFS (urut berdasarkan Arrival Time)', processes: deepSnapshot(procs) });

        for (const proc of procs) {
            // advance time if process hasn't arrived yet
            if (t < proc.arrivalTime) {
                // advance time to proc.arrivalTime
                t = proc.arrivalTime;
                // mark any that have arrived as Ready
                procs.forEach(p=>{ if (p.status !== 'Terminated' && p.arrivalTime <= t) p.status = 'Ready'; });
                steps.push({ time: t, description: `Waktu maju ke ${t}s (menunggu arrival)`, processes: deepSnapshot(procs) });
            }

            // ensure this proc is Ready now
            if (proc.status === 'New' && proc.arrivalTime <= t) proc.status = 'Ready';

            // set to Running
            proc.status = 'Running';
            procs.forEach(p=>{ if (p !== proc && p.status !== 'Terminated' && p.arrivalTime <= t) p.status = 'Ready'; });
            steps.push({ time: t, description: `Proses ${proc.name} mulai Running`, processes: deepSnapshot(procs) });

            // execute until finished (non-preemptive)
            while (proc.remainingTime > 0) {
                t++;
                proc.remainingTime--;
                // update statuses for processes that have arrived in meantime
                procs.forEach(p=>{ if (p.status === 'New' && p.arrivalTime <= t) p.status = 'Ready'; });
                steps.push({ time: t, description: `Proses ${proc.name} mengeksekusi (sisa ${proc.remainingTime}s)`, processes: deepSnapshot(procs) });
            }

            proc.remainingTime = 0;
            proc.status = 'Terminated';
            steps.push({ time: t, description: `Proses ${proc.name} Terminated`, processes: deepSnapshot(procs) });
        }

        steps.push({ time: t, description: 'Semua proses selesai (FCFS)', processes: deepSnapshot(procs) });
        return steps;
    }

    // SJF (non-preemptive) - choose shortest burst from Ready queue (New -> Ready when arrival reached)
    function simulateSJF(inputProcesses){
        const procs = inputProcesses.map(p=>({ ...p }));
        procs.forEach(p=>{ p.remainingTime = p.remainingTime ?? p.burstTime; p.status = 'New'; });
        let t = 0;
        const steps = [];
        steps.push({ time: t, description: 'Mulai SJF (Non-Preemptive)', processes: deepSnapshot(procs) });

        while (procs.some(p=> p.status !== 'Terminated')) {
            // move arrivals to Ready
            procs.forEach(p=>{ if (p.status === 'New' && p.arrivalTime <= t) p.status = 'Ready'; });
            const ready = procs.filter(p=> p.status === 'Ready');
            if (ready.length === 0) {
                // no ready process — advance time
                t++;
                continue;
            }
            // pick shortest burst (remainingTime) among ready
            ready.sort((a,b)=> a.remainingTime - b.remainingTime || a.arrivalTime - b.arrivalTime);
            const cur = ready[0];
            cur.status = 'Running';
            steps.push({ time: t, description: `Proses ${cur.name} dipilih (burst terpendek)`, processes: deepSnapshot(procs) });

            // execute to completion (non-preemptive)
            while (cur.remainingTime > 0) {
                t++;
                cur.remainingTime--;
                // update arrivals during execution
                procs.forEach(p=>{ if (p.status === 'New' && p.arrivalTime <= t) p.status = 'Ready'; });
                steps.push({ time: t, description: `Proses ${cur.name} mengeksekusi (sisa ${cur.remainingTime}s)`, processes: deepSnapshot(procs) });
            }

            cur.remainingTime = 0;
            cur.status = 'Terminated';
            steps.push({ time: t, description: `Proses ${cur.name} Terminated`, processes: deepSnapshot(procs) });
        }

        steps.push({ time: t, description: 'Semua proses selesai (SJF)', processes: deepSnapshot(procs) });
        return steps;
    }

    // Priority Preemptive - check every tick for higher priority arrival (smaller number = higher priority)
    function simulatePriorityPreemptive(inputProcesses){
        const procs = inputProcesses.map(p=>({ ...p }));
        procs.forEach(p=>{ p.remainingTime = p.remainingTime ?? p.burstTime; p.status = 'New'; });
        let t = 0;
        const steps = [];
        steps.push({ time: t, description: 'Mulai Priority (Preemptive)', processes: deepSnapshot(procs) });

        while (procs.some(p=> p.status !== 'Terminated')) {
            // arrivals -> Ready
            procs.forEach(p=>{ if (p.status === 'New' && p.arrivalTime <= t) p.status = 'Ready'; });
            const ready = procs.filter(p=> p.status === 'Ready');
            if (ready.length === 0) {
                t++;
                continue;
            }
            // pick the highest priority (smallest priority number). tie-breaker arrivalTime then name
            ready.sort((a,b)=> a.priority - b.priority || a.arrivalTime - b.arrivalTime || a.name.localeCompare(b.name));
            const cur = ready[0];
            cur.status = 'Running';
            steps.push({ time: t, description: `Proses ${cur.name} Running (prio ${cur.priority})`, processes: deepSnapshot(procs) });

            // execute one tick, then re-evaluate for preemption
            t++;
            cur.remainingTime--;
            // during this tick new arrivals may become Ready
            procs.forEach(p=>{ if (p.status === 'New' && p.arrivalTime <= t) p.status = 'Ready'; });
            steps.push({ time: t, description: `Proses ${cur.name} mengeksekusi (sisa ${cur.remainingTime}s)`, processes: deepSnapshot(procs) });

            if (cur.remainingTime <= 0) {
                cur.remainingTime = 0;
                cur.status = 'Terminated';
                steps.push({ time: t, description: `Proses ${cur.name} Terminated`, processes: deepSnapshot(procs) });
            } else {
                // after one tick, set back to Ready to allow preemption selection next loop
                cur.status = 'Ready';
            }
        }

        steps.push({ time: t, description: 'Semua proses selesai (Priority Preemptive)', processes: deepSnapshot(procs) });
        return steps;
    }

    // Round Robin - quantum chosen once; processes start New -> Ready when arrival reached
    function simulateRoundRobin(inputProcesses, quantum=2){
        const procs = inputProcesses.map(p=>({ ...p }));
        procs.forEach(p=>{ p.remainingTime = p.remainingTime ?? p.burstTime; p.status = 'New'; });
        let t = 0;
        const steps = [];
        const queue = [];
        steps.push({ time: t, description: `Mulai Round Robin (quantum ${quantum}s)`, processes: deepSnapshot(procs) });

        while (procs.some(p=> p.status !== 'Terminated')) {
            // enqueue arrivals (New -> Ready)
            procs.forEach(p=>{
                if ((p.status === 'New' || p.status === 'Ready') && p.arrivalTime <= t && !queue.includes(p) && p.status !== 'Terminated') {
                    if (p.status === 'New') p.status = 'Ready';
                    queue.push(p);
                }
            });

            if (queue.length === 0) {
                // no process ready, advance time
                t++;
                continue;
            }

            const cur = queue.shift();
            if (cur.status !== 'Terminated') cur.status = 'Running';
            steps.push({ time: t, description: `Proses ${cur.name} mulai Running (sisa ${cur.remainingTime}s)`, processes: deepSnapshot(procs) });

            let q = 0;
            while (q < quantum && cur.remainingTime > 0) {
                t++; q++; cur.remainingTime--;
                // arrivals during execution -> enqueue newly arrived processes
                procs.forEach(p=>{
                    if ((p.status === 'New' || p.status === 'Ready') && p.arrivalTime <= t && !queue.includes(p) && p.status !== 'Terminated' && p !== cur) {
                        if (p.status === 'New') p.status = 'Ready';
                        queue.push(p);
                    }
                });
                steps.push({ time: t, description: `Proses ${cur.name} mengeksekusi (${q}/${quantum}s) (sisa ${cur.remainingTime}s)`, processes: deepSnapshot(procs) });
            }

            if (cur.remainingTime <= 0) {
                cur.remainingTime = 0;
                cur.status = 'Terminated';
                steps.push({ time: t, description: `Proses ${cur.name} Terminated`, processes: deepSnapshot(procs) });
            } else {
                // quantum habis -> back to Ready and enqueue at end
                cur.status = 'Ready';
                queue.push(cur);
                steps.push({ time: t, description: `Quantum habis: ${cur.name} kembali ke Ready (sisa ${cur.remainingTime}s)`, processes: deepSnapshot(procs) });
            }
        }

        steps.push({ time: t, description: 'Semua proses selesai (Round Robin)', processes: deepSnapshot(procs) });
        return steps;
    }