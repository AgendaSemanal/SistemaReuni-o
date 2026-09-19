const meetingTimes = [
    "07:00",
    "10:00",
    "12:00",
    "15:00",
    "18:00",
    "19:30"
];

const defaultPastors = [
    "Pastor Responsável 01",
    "Pastor Responsável 02",
    "Pastor Responsável 03",
    "Pastor Responsável 04"
];

let selectedDate = getToday();
let selectedMeetingTime = null;


/* =========================
   INICIALIZAÇÃO
========================= */

window.addEventListener("load", () => {

    initializePastors();

    setTimeout(() => {

        document
            .getElementById("loadingScreen")
            .classList.add("hidden");

        document
            .getElementById("app")
            .classList.remove("hidden");

        initializeSystem();

    }, 1800);

});


function initializeSystem() {

    document.getElementById("currentDateLabel").textContent =
        formatDateWithWeekday(selectedDate);

    updateDateDisplay();

    initializeReportDates();

    renderTimeline();

}


/* =========================
   NAVEGAÇÃO
========================= */

function showScreen(screenId) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.add("hidden");
        });


    const screen = document.getElementById(screenId);

    if (screen) {
        screen.classList.remove("hidden");
    }


    if (screenId === "meetingsScreen") {

        document.getElementById("currentDateLabel").textContent =
            formatDateWithWeekday(selectedDate);

        updateDateDisplay();

        renderTimeline();

    }


    if (screenId === "reportsScreen") {

        generateReport();

    }

}


/* =========================
   DATAS
========================= */

function getToday() {

    const date = new Date();

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatDateBR(dateString) {

    const parts = dateString.split("-");

    return `${parts[2]}/${parts[1]}/${parts[0]}`;

}


function getDateFromString(dateString) {

    const [year, month, day] =
        dateString.split("-").map(Number);

    return new Date(
        year,
        month - 1,
        day,
        12,
        0,
        0
    );

}


function formatDateWithWeekday(dateString) {

    const date = getDateFromString(dateString);

    const datePart = new Intl.DateTimeFormat(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);


    const weekday = new Intl.DateTimeFormat(
        "pt-BR",
        {
            weekday: "long"
        }
    ).format(date);


    const capitalizedWeekday =
        weekday.charAt(0).toUpperCase() +
        weekday.slice(1);


    return `${datePart} — ${capitalizedWeekday}`;

}


function formatDateLong(date) {

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    ).format(date);

}


function updateDateDisplay() {

    document.getElementById("selectedDateText").textContent =
        formatDateWithWeekday(selectedDate);

}


/* =========================
   SELEÇÃO DE DATA
========================= */

function openDatePicker() {

    document.getElementById("datePicker").value =
        selectedDate;

    document
        .getElementById("dateModal")
        .classList.remove("hidden");

}


function closeDatePicker() {

    document
        .getElementById("dateModal")
        .classList.add("hidden");

}


function selectDate() {

    const date =
        document.getElementById("datePicker").value;


    if (!date) {

        alert("Selecione uma data.");

        return;

    }


    selectedDate = date;

    closeDatePicker();

    document.getElementById("currentDateLabel").textContent =
        formatDateWithWeekday(selectedDate);

    updateDateDisplay();

    renderTimeline();

}


/* =========================
   BANCO LOCAL DAS REUNIÕES
========================= */

function getStorageKey(date, time) {

    return `reuniao_${date}_${time.replace(":", "")}`;

}


function getMeeting(date, time) {

    const key =
        getStorageKey(date, time);

    const data =
        localStorage.getItem(key);


    if (!data) {
        return null;
    }


    try {

        return JSON.parse(data);

    } catch {

        return null;

    }

}


function saveMeetingData(date, time, data) {

    const key =
        getStorageKey(date, time);

    localStorage.setItem(
        key,
        JSON.stringify(data)
    );

}


/* =========================
   HORÁRIO ATUAL
========================= */

function getCurrentMeetingTime() {

    const now = new Date();

    const currentTotal =
        now.getHours() * 60 +
        now.getMinutes();


    /*
        00:00 - 09:59
        reunião das 07:00
    */

    if (currentTotal < 10 * 60) {

        return "07:00";

    }


    /*
        10:00 - 11:59
    */

    if (currentTotal < 12 * 60) {

        return "10:00";

    }


    /*
        12:00 - 14:59
    */

    if (currentTotal < 15 * 60) {

        return "12:00";

    }


    /*
        15:00 - 17:59
    */

    if (currentTotal < 18 * 60) {

        return "15:00";

    }


    /*
        18:00 - 19:29
    */

    if (currentTotal < (19 * 60 + 30)) {

        return "18:00";

    }


    /*
        19:30 - 23:59
    */

    return "19:30";

}


/* =========================
   STATUS DA REUNIÃO
========================= */

function getMeetingStatus(dateString, timeString) {

    const meeting =
        getMeeting(dateString, timeString);


    /*
        Se já foi preenchida,
        sempre aparece como preenchida.
    */

    if (meeting) {

        return "filled";

    }


    const today =
        getToday();


    /*
        Data anterior:
        reunião ficou pendente.
    */

    if (dateString < today) {

        return "pending";

    }


    /*
        Data futura:
        ainda não chegou.
    */

    if (dateString > today) {

        return "future";

    }


    /*
        É hoje.
    */

    const currentTime =
        getCurrentMeetingTime();


    const currentIndex =
        meetingTimes.indexOf(currentTime);


    const meetingIndex =
        meetingTimes.indexOf(timeString);


    /*
        Reunião atualmente em andamento.
    */

    if (meetingIndex === currentIndex) {

        return "current";

    }


    /*
        Horários anteriores ao atual.
    */

    if (meetingIndex < currentIndex) {

        return "pending";

    }


    /*
        Horários posteriores.
    */

    return "future";

}


/* =========================
   TIMELINE
========================= */

function renderTimeline() {

    const timeline =
        document.getElementById("timeline");


    timeline.innerHTML = "";


    let filled = 0;

    let pending = 0;

    let totalPeople = 0;


    meetingTimes.forEach(time => {

        const status =
            getMeetingStatus(
                selectedDate,
                time
            );


        const meeting =
            getMeeting(
                selectedDate,
                time
            );


        if (meeting) {

            filled++;

            totalPeople +=
                Number(meeting.people || 0);

        }


        if (status === "pending") {

            pending++;

        }


        const item =
            document.createElement("div");


        item.className =
            `timeline-item status-${status}`;


        let statusText = "";


        if (status === "filled") {

            statusText = "Preenchida";

        } else if (status === "pending") {

            statusText = "Pendente";

        } else if (status === "current") {

            statusText = "Atual";

        } else {

            statusText = "Próxima";

        }


        const peopleText =
            meeting
                ? `${Number(meeting.people || 0).toLocaleString("pt-BR")} pessoas`
                : "Quantidade não informada";


        const pastorText =
            meeting?.pastor
                ? meeting.pastor
                : "Clique para preencher";


        item.innerHTML = `

            <div class="timeline-status"></div>

            <div class="timeline-content">

                <div class="timeline-time">
                    ${time}
                </div>

                <div class="timeline-status-text">
                    ${statusText}
                </div>

                <div class="timeline-people">
                    ${peopleText}
                </div>

                <div class="timeline-pastor">
                    ${pastorText}
                </div>

            </div>

        `;


        item.addEventListener(
            "click",
            () => openMeeting(time)
        );


        timeline.appendChild(item);

    });


    document.getElementById("totalMeetings").textContent =
        `${filled} / ${meetingTimes.length}`;


    document.getElementById("filledMeetings").textContent =
        filled;


    document.getElementById("pendingMeetings").textContent =
        pending;


    document.getElementById("peopleTotal").textContent =
        totalPeople.toLocaleString("pt-BR");

}


/* =========================
   REUNIÃO
========================= */

function openMeeting(time) {

    selectedMeetingTime = time;


    const meeting =
        getMeeting(
            selectedDate,
            time
        );


    document.getElementById("modalMeetingTime").textContent =
        time;


    document.getElementById("modalMeetingDate").textContent =
        formatDateWithWeekday(selectedDate);


    loadPastorSelect(
        meeting?.pastor || ""
    );


    document.getElementById("people").value =
        meeting?.people ?? "";


    document.getElementById("observations").value =
        meeting?.observations || "";


    document
        .getElementById("meetingModal")
        .classList.remove("hidden");

}


function closeMeetingModal() {

    document
        .getElementById("meetingModal")
        .classList.add("hidden");


    selectedMeetingTime = null;

}


function saveMeeting() {

    if (!selectedMeetingTime) {
        return;
    }


    const pastor =
        document.getElementById("pastor").value;


    const people =
        document.getElementById("people").value;


    const observations =
        document.getElementById("observations").value;


    if (!pastor) {

        alert(
            "Selecione o pastor responsável."
        );

        return;

    }


    if (
        people === "" ||
        Number(people) < 0
    ) {

        alert(
            "Informe a quantidade de pessoas."
        );

        return;

    }


    const data = {

        date: selectedDate,

        time: selectedMeetingTime,

        pastor: pastor,

        people: Number(people),

        observations: observations,

        createdAt:
            new Date().toISOString()

    };


    saveMeetingData(
        selectedDate,
        selectedMeetingTime,
        data
    );


    closeMeetingModal();

    renderTimeline();


    alert(
        "Reunião salva com sucesso!"
    );

}


/* =========================
   PASTORES
========================= */

function initializePastors() {

    const saved =
        localStorage.getItem(
            "pastores"
        );


    /*
        Na primeira utilização,
        mantém os quatro nomes que já
        existiam no sistema.
    */

    if (saved === null) {

        localStorage.setItem(
            "pastores",
            JSON.stringify(defaultPastors)
        );

    }

}


function getPastors() {

    const saved =
        localStorage.getItem(
            "pastores"
        );


    if (saved === null) {

        return [...defaultPastors];

    }


    try {

        const pastors =
            JSON.parse(saved);


        return Array.isArray(pastors)
            ? pastors
            : [];

    } catch {

        return [];

    }

}


function savePastors(pastors) {

    localStorage.setItem(
        "pastores",
        JSON.stringify(pastors)
    );

}


function loadPastorSelect(selectedPastor = "") {

    const select =
        document.getElementById("pastor");


    select.innerHTML = "";


    const pastors =
        getPastors();


    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";

    defaultOption.textContent =
        "Selecione o pastor";

    select.appendChild(
        defaultOption
    );


    pastors.forEach(pastorName => {

        const option =
            document.createElement("option");


        option.value =
            pastorName;

        option.textContent =
            pastorName;


        select.appendChild(option);

    });


    /*
        Caso exista um registro antigo
        cujo pastor não esteja mais na lista,
        mantém o nome disponível para visualização.
    */

    if (
        selectedPastor &&
        !pastors.includes(selectedPastor)
    ) {

        const option =
            document.createElement("option");


        option.value =
            selectedPastor;

        option.textContent =
            selectedPastor +
            " (registro anterior)";


        select.appendChild(option);

    }


    select.value =
        selectedPastor;

}


function openPastorModal() {

    document
        .getElementById("pastorModal")
        .classList.remove("hidden");


    document.getElementById("newPastor").value = "";


    renderPastorList();


    setTimeout(() => {

        document
            .getElementById("newPastor")
            .focus();

    }, 100);

}


function closePastorModal() {

    document
        .getElementById("pastorModal")
        .classList.add("hidden");

}


function addPastor() {

    const input =
        document.getElementById("newPastor");


    const name =
        input.value.trim();


    if (!name) {

        alert(
            "Digite o nome do pastor."
        );

        input.focus();

        return;

    }


    const pastors =
        getPastors();


    const alreadyExists =
        pastors.some(
            pastor =>
                pastor.toLowerCase() ===
                name.toLowerCase()
        );


    if (alreadyExists) {

        alert(
            "Esse pastor já está cadastrado."
        );

        input.focus();

        return;

    }


    pastors.push(name);


    pastors.sort(
        (a, b) =>
            a.localeCompare(
                b,
                "pt-BR"
            )
    );


    savePastors(pastors);


    input.value = "";


    renderPastorList();

    loadPastorSelect();


    input.focus();

}


function renderPastorList() {

    const list =
        document.getElementById("pastorList");


    list.innerHTML = "";


    const pastors =
        getPastors();


    if (!pastors.length) {

        list.innerHTML = `
            <div class="empty-pastors">
                Nenhum pastor cadastrado.
            </div>
        `;

        return;

    }


    pastors.forEach(
        (pastor, index) => {

            const item =
                document.createElement("div");


            item.className =
                "pastor-item";


            item.innerHTML = `

                <span class="pastor-item-name">
                    ${escapeHTML(pastor)}
                </span>

                <button
                    class="delete-pastor"
                    onclick="deletePastor(${index})"
                >
                    Excluir
                </button>

            `;


            list.appendChild(item);

        }
    );

}


function deletePastor(index) {

    const pastors =
        getPastors();


    const pastor =
        pastors[index];


    if (!pastor) {
        return;
    }


    const confirmed =
        confirm(
            `Deseja excluir o pastor "${pastor}" da lista?`
        );


    if (!confirmed) {
        return;
    }


    pastors.splice(
        index,
        1
    );


    savePastors(pastors);


    renderPastorList();

    loadPastorSelect();

}


function escapeHTML(text) {

    const div =
        document.createElement("div");


    div.textContent = text;


    return div.innerHTML;

}


/* =========================
   RELATÓRIOS
========================= */

function initializeReportDates() {

    const today =
        getToday();


    document.getElementById(
        "reportStart"
    ).value = today;


    document.getElementById(
        "reportEnd"
    ).value = today;

}


function getAllMeetings() {

    const meetings = [];


    for (
        let i = 0;
        i < localStorage.length;
        i++
    ) {

        const key =
            localStorage.key(i);


        if (
            !key ||
            !key.startsWith("reuniao_")
        ) {
            continue;
        }


        try {

            const data =
                JSON.parse(
                    localStorage.getItem(key)
                );


            if (data) {
                meetings.push(data);
            }

        } catch {}

    }


    meetings.sort(
        (a, b) => {

            const dateA =
                `${a.date}T${a.time}`;


            const dateB =
                `${b.date}T${b.time}`;


            return dateB.localeCompare(
                dateA
            );

        }
    );


    return meetings;

}


function generateReport() {

    const start =
        document.getElementById(
            "reportStart"
        ).value;


    const end =
        document.getElementById(
            "reportEnd"
        ).value;


    if (!start || !end) {
        return;
    }


    const meetings =
        getAllMeetings().filter(
            meeting =>
                meeting.date >= start &&
                meeting.date <= end
        );


    const totalPeople =
        meetings.reduce(
            (sum, meeting) =>
                sum +
                Number(
                    meeting.people || 0
                ),
            0
        );


    const average =
        meetings.length
            ? Math.round(
                totalPeople /
                meetings.length
            )
            : 0;


    const uniqueDays =
        new Set(
            meetings.map(
                meeting =>
                    meeting.date
            )
        ).size;


    document.getElementById(
        "reportMeetings"
    ).textContent =
        meetings.length;


    document.getElementById(
        "reportPeople"
    ).textContent =
        totalPeople.toLocaleString(
            "pt-BR"
        );


    document.getElementById(
        "reportAverage"
    ).textContent =
        average.toLocaleString(
            "pt-BR"
        );


    document.getElementById(
        "reportDays"
    ).textContent =
        uniqueDays;


    renderReportTable(
        meetings
    );

}


function renderReportTable(meetings) {

    const tbody =
        document.getElementById(
            "reportTableBody"
        );


    tbody.innerHTML = "";


    if (!meetings.length) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    style="
                        text-align:center;
                        padding:35px;
                        color:#888;
                    "
                >
                    Nenhuma reunião encontrada
                    no período selecionado.
                </td>

            </tr>

        `;

        return;

    }


    meetings.forEach(meeting => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${formatDateBR(meeting.date)}
            </td>

            <td>
                <strong>
                    ${meeting.time}
                </strong>
            </td>

            <td>
                ${escapeHTML(
                    meeting.pastor
                )}
            </td>

            <td>
                ${Number(
                    meeting.people || 0
                ).toLocaleString("pt-BR")}
            </td>

            <td>
                ${meeting.observations
                    ? escapeHTML(
                        meeting.observations
                    )
                    : "—"}
            </td>

            <td>

                <button
                    class="edit-table-button"
                    onclick="
                        editMeeting(
                            '${meeting.date}',
                            '${meeting.time}'
                        )
                    "
                >
                    Visualizar
                </button>

            </td>

        `;


        tbody.appendChild(row);

    });

}


function editMeeting(date, time) {

    selectedDate = date;


    showScreen(
        "meetingsScreen"
    );


    updateDateDisplay();


    openMeeting(time);

}


/* =========================
   FECHAMENTO DOS MODAIS
========================= */

document.addEventListener(
    "click",
    function(event) {

        const dateModal =
            document.getElementById(
                "dateModal"
            );


        const meetingModal =
            document.getElementById(
                "meetingModal"
            );


        const pastorModal =
            document.getElementById(
                "pastorModal"
            );


        if (
            event.target === dateModal
        ) {

            closeDatePicker();

        }


        if (
            event.target === meetingModal
        ) {

            closeMeetingModal();

        }


        if (
            event.target === pastorModal
        ) {

            closePastorModal();

        }

    }
);


/* =========================
   ENTER NO CADASTRO
========================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            document.activeElement?.id ===
            "newPastor"
        ) {

            event.preventDefault();

            addPastor();

        }

    }
);