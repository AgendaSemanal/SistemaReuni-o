/* =========================================
   CONFIGURAÇÕES
========================================= */

const API_URL =
    "https://script.google.com/macros/s/AKfycbwXfQ9KcqTX25PeVSjNO22kJgwdpc9IpNpHcLAhAWMtBH6EcjSOMgMLRpewUwNojnV3/exec";


/*
   Intervalo de sincronização automática.
*/
const CLOUD_SYNC_INTERVAL = 5000;


const meetingSchedules = {

    0: ["07:00", "09:30", "15:00", "15:30", "18:00"],

    1: ["07:00", "10:00", "12:00", "15:00", "18:00", "19:30"],

    2: ["07:00", "10:00", "12:00", "15:00", "18:00", "19:30"],

    3: ["07:00", "10:00", "12:00", "15:00", "18:00", "19:30"],

    4: ["07:00", "10:00", "12:00", "15:00", "18:00", "19:30"],

    5: ["07:00", "10:00", "12:00", "15:00", "18:00", "19:30"],

    6: ["07:00", "10:00", "12:00", "15:00", "18:00"]

};


/* =========================================
   PASTORES PADRÃO
========================================= */

const defaultPastors = [

    "Pastor Responsável 01",

    "Pastor Responsável 02",

    "Pastor Responsável 03",

    "Pastor Responsável 04"

];


/* =========================================
   CACHE DOS DADOS
========================================= */

let meetingsCache = [];

let pastorsCache = [];

let pastorIdsCache = {};


/*
   Indica se a primeira sincronização
   já foi realizada.
*/

let cloudInitialized = false;


/*
   Evita várias sincronizações simultâneas.
*/

let cloudSyncInProgress = false;


/*
   Indica que uma reunião está sendo salva.

   Enquanto estiver TRUE, nenhuma consulta
   automática poderá sobrescrever os dados.
*/

let meetingSaveInProgress = false;


/*
   Guarda o momento da última alteração
   feita pelo próprio sistema.
*/

let lastLocalMeetingChange = 0;


/*
   Guarda a última versão conhecida
   dos dados da nuvem.
*/

let lastCloudMeetingsSignature = "";

let lastCloudPastorsSignature = "";


/* =========================================
   INICIALIZAÇÃO
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initializePastors();

        loadLocalCache();


        /*
           Mostra o sistema rapidamente
           usando o cache local.
        */

        setTimeout(
            () => {

                const loadingScreen =
                    document.getElementById(
                        "loadingScreen"
                    );

                const app =
                    document.getElementById(
                        "app"
                    );


                if (loadingScreen) {

                    loadingScreen.classList.add(
                        "hidden"
                    );

                }


                if (app) {

                    app.classList.remove(
                        "hidden"
                    );

                }

            },
            3500
        );


        updateDateLabels();

        renderTimeline();

        updateSummary();


        if (
            document.getElementById(
                "reportStart"
            )
        ) {

            initializeReports();

        }


        /*
           Primeira sincronização.
        */

        await loadCloudData();


        /*
           Inicia sincronização automática.
        */

        startCloudAutoSync();

    }
);


/* =========================================
   SINCRONIZAÇÃO AUTOMÁTICA
========================================= */

function startCloudAutoSync() {

    /*
       Evita criar vários intervalos.
    */

    if (
        window.reunioesCloudSyncInterval
    ) {

        clearInterval(
            window.reunioesCloudSyncInterval
        );

    }


    window.reunioesCloudSyncInterval =
        setInterval(
            () => {

                syncCloudSilently();

            },
            CLOUD_SYNC_INTERVAL
        );

}


/* =========================================
   SINCRONIZAÇÃO SILENCIOSA
========================================= */

async function syncCloudSilently() {

    /*
       Não inicia outra sincronização
       enquanto uma já estiver acontecendo.
    */

    if (cloudSyncInProgress) {
        return;
    }


    /*
       Não consulta a nuvem enquanto uma
       reunião estiver sendo salva.
    */

    if (meetingSaveInProgress) {
        return;
    }


    /*
       Aguarda a primeira sincronização.
    */

    if (!cloudInitialized) {
        return;
    }


    cloudSyncInProgress = true;


    try {

        const [
            meetingsData,
            pastorsData
        ] = await Promise.all([

            apiGet("getMeetings"),

            apiGet("getPastors")

        ]);


        /*
           Verifica se as respostas são válidas.
        */

        const meetingsResponseValid =
            meetingsData &&
            meetingsData.success === true &&
            Array.isArray(
                meetingsData.meetings
            );


        const pastorsResponseValid =
            pastorsData &&
            pastorsData.success === true &&
            Array.isArray(
                pastorsData.pastors
            );


        /* =====================================
           REUNIÕES
        ===================================== */

        if (meetingsResponseValid) {

            const cloudMeetings =
                meetingsData.meetings.map(
                    normalizeMeeting
                );


            const meetingsSignature =
                createMeetingsSignature(
                    cloudMeetings
                );


            /*
               Se a nuvem retornou reuniões,
               podemos sincronizar normalmente.
            */

            if (
                cloudMeetings.length > 0
            ) {

                const timeSinceLocalChange =
                    Date.now() -
                    lastLocalMeetingChange;


                /*
                   Não sobrescreve uma alteração
                   recém-realizada pelo usuário.
                */

                if (
                    timeSinceLocalChange >= 5000
                ) {

                    if (
                        meetingsSignature !==
                        lastCloudMeetingsSignature
                    ) {

                        meetingsCache =
                            cloudMeetings;


                        saveMeetings(
                            meetingsCache
                        );


                        lastCloudMeetingsSignature =
                            meetingsSignature;


                        renderTimeline();

                        updateSummary();


                        const reportsScreen =
                            document.getElementById(
                                "reportsScreen"
                            );


                        if (
                            reportsScreen &&
                            !reportsScreen.classList.contains(
                                "hidden"
                            )
                        ) {

                            renderReports();

                        }

                    }

                }

            } else {

                /*
                   PROTEÇÃO PRINCIPAL:

                   Se o Sheets retornar vazio,
                   NÃO apagamos reuniões que já
                   existem no sistema.
                */

                if (
                    meetingsCache.length === 0
                ) {

                    lastCloudMeetingsSignature =
                        meetingsSignature;

                }

            }

        }


        /* =====================================
           PASTORES
        ===================================== */

        if (pastorsResponseValid) {

            const cloudPastors =
                pastorsData.pastors;


            const pastorsSignature =
                createPastorsSignature(
                    cloudPastors
                );


            if (
                pastorsSignature !==
                lastCloudPastorsSignature
            ) {

                setCloudPastors(
                    cloudPastors
                );


                lastCloudPastorsSignature =
                    pastorsSignature;


                renderPastorList();

                loadPastorSelect();

            }

        }


    } catch (error) {

        /*
           Se a nuvem falhar, NÃO apagamos
           absolutamente nada da tela.
        */

        console.warn(
            "Sincronização automática:",
            error
        );

    } finally {

        cloudSyncInProgress = false;

    }

}


/* =========================================
   ASSINATURA DAS REUNIÕES
========================================= */

function createMeetingsSignature(
    meetings
) {

    return meetings
        .map(
            meeting => {

                const normalized =
                    normalizeMeeting(
                        meeting
                    );


                return [

                    normalized.id,

                    normalized.date,

                    normalized.time,

                    normalized.people,

                    normalized.pastor,

                    normalized.observations

                ].join("|");

            }
        )
        .sort()
        .join("||");

}


/* =========================================
   ASSINATURA DOS PASTORES
========================================= */

function createPastorsSignature(
    pastors
) {

    return pastors
        .map(
            pastor => {

                return [

                    pastor.id,

                    pastor.name,

                    pastor.active

                ].join("|");

            }
        )
        .sort()
        .join("||");

}


/* =========================================
   CACHE LOCAL
========================================= */

function loadLocalCache() {

    try {

        const meetings =
            JSON.parse(
                localStorage.getItem(
                    "reunioes"
                )
            );


        if (
            Array.isArray(
                meetings
            )
        ) {

            meetingsCache =
                meetings.map(
                    normalizeMeeting
                );

        }

    } catch (error) {

        meetingsCache = [];

    }


    try {

        const pastors =
            JSON.parse(
                localStorage.getItem(
                    "pastores"
                )
            );


        if (
            Array.isArray(
                pastors
            )
        ) {

            pastorsCache =
                pastors;

        }

    } catch (error) {

        pastorsCache = [];

    }

}


/* =========================================
   COMUNICAÇÃO COM API
========================================= */

async function apiGet(
    action
) {

    const response =
        await fetch(

            `${API_URL}?action=${encodeURIComponent(
                action
            )}&t=${Date.now()}`,

            {

                method: "GET",

                cache: "no-store"

            }

        );


    if (!response.ok) {

        throw new Error(
            `Erro HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    if (!data.success) {

        throw new Error(

            data.error ||
            data.message ||
            "Erro na API."

        );

    }


    return data;

}


/* =========================================
   POST API
========================================= */

async function apiPost(
    payload
) {

    const response =
        await fetch(

            API_URL,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "text/plain;charset=utf-8"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }

        );


    if (!response.ok) {

        throw new Error(
            `Erro HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    if (!data.success) {

        throw new Error(

            data.error ||
            data.message ||
            "Erro na API."

        );

    }


    return data;

}


/* =========================================
   PRIMEIRA SINCRONIZAÇÃO
========================================= */

async function loadCloudData() {

    if (cloudSyncInProgress) {
        return;
    }


    cloudSyncInProgress = true;


    try {

        const [
            meetingsData,
            pastorsData
        ] = await Promise.all([

            apiGet(
                "getMeetings"
            ),

            apiGet(
                "getPastors"
            )

        ]);


        const cloudMeetings =
            Array.isArray(
                meetingsData.meetings
            )
                ? meetingsData.meetings.map(
                    normalizeMeeting
                )
                : [];


        const cloudPastors =
            Array.isArray(
                pastorsData.pastors
            )
                ? pastorsData.pastors
                : [];


        /* =====================================
           REUNIÕES
        ===================================== */

        const localMeetings =
            getMeetings();


        /*
           Se o Sheets está vazio e existem
           dados antigos no navegador,
           fazemos uma migração única.
        */

        if (
            cloudMeetings.length === 0 &&
            localMeetings.length > 0
        ) {

            for (
                const meeting
                of localMeetings
            ) {

                try {

                    const normalized =
                        normalizeMeeting(
                            meeting
                        );


                    await apiPost({

                        action:
                            "saveMeeting",

                        id:
                            normalized.id,

                        date:
                            normalized.date,

                        day:
                            getWeekdayName(
                                normalized.date
                            ),

                        time:
                            normalized.time,

                        people:
                            normalized.people,

                        pastor:
                            normalized.pastor,

                        observations:
                            normalized.observations

                    });

                } catch (error) {

                    console.warn(
                        "Não foi possível migrar reunião:",
                        meeting,
                        error
                    );

                }

            }


            /*
               Busca novamente depois
               da migração.
            */

            const refreshed =
                await apiGet(
                    "getMeetings"
                );


            if (
                Array.isArray(
                    refreshed.meetings
                )
            ) {

                meetingsCache =
                    refreshed.meetings.map(
                        normalizeMeeting
                    );

            }

        } else {

            /*
               A partir daqui o Sheets
               é a fonte oficial.
            */

            meetingsCache =
                cloudMeetings;

        }


        lastCloudMeetingsSignature =
            createMeetingsSignature(
                meetingsCache
            );


        saveMeetings(
            meetingsCache
        );


        /* =====================================
           PASTORES
        ===================================== */

        if (
            cloudPastors.length === 0
        ) {

            let localPastors =
                getPastors();


            if (
                !localPastors.length
            ) {

                localPastors =
                    defaultPastors.slice();

            }


            for (
                const pastor
                of localPastors
            ) {

                try {

                    await apiPost({

                        action:
                            "savePastor",

                        name:
                            pastor

                    });

                } catch (error) {

                    console.warn(
                        "Não foi possível migrar pastor:",
                        pastor,
                        error
                    );

                }

            }


            const refreshedPastors =
                await apiGet(
                    "getPastors"
                );


            setCloudPastors(
                refreshedPastors.pastors || []
            );


            lastCloudPastorsSignature =
                createPastorsSignature(
                    refreshedPastors.pastors || []
                );

        } else {

            setCloudPastors(
                cloudPastors
            );


            lastCloudPastorsSignature =
                createPastorsSignature(
                    cloudPastors
                );

        }


        cloudInitialized = true;


        updateDateLabels();

        renderTimeline();

        updateSummary();

        renderPastorList();

        loadPastorSelect();


        const reportsScreen =
            document.getElementById(
                "reportsScreen"
            );


        if (
            reportsScreen &&
            !reportsScreen.classList.contains(
                "hidden"
            )
        ) {

            renderReports();

        }


    } catch (error) {

        console.warn(
            "Não foi possível sincronizar com o Google Sheets:",
            error
        );


        /*
           Mantém o cache local se o Sheets
           estiver temporariamente indisponível.
        */

        cloudInitialized = true;

    } finally {

        cloudSyncInProgress = false;

    }

}


/* =========================================
   ATUALIZAR PASTORES DA NUVEM
========================================= */

function setCloudPastors(
    pastors
) {

    pastorsCache =
        pastors

            .filter(
                pastor =>
                    pastor &&
                    pastor.name &&
                    pastor.active !== false
            )

            .map(
                pastor =>
                    pastor.name
            );


    pastorIdsCache = {};


    /*
       Guarda os IDs de todos os pastores,
       inclusive os inativos.
    */

    pastors.forEach(
        pastor => {

            if (
                pastor &&
                pastor.name
            ) {

                pastorIdsCache[
                    pastor.name
                ] =
                    pastor.id;

            }

        }
    );


    savePastors(
        pastorsCache
    );

}


/* =========================================
   NORMALIZAR REUNIÃO
========================================= */

function normalizeMeeting(
    meeting
) {

    meeting =
        meeting || {};


    const date =
        meeting.date || "";


    const time =
        meeting.time || "";


    const id =
        meeting.id !== undefined &&
        meeting.id !== null &&
        meeting.id !== ""

            ? String(
                meeting.id
            )

            : `${date}_${time}`;


    return {

        id:

            id,

        date:

            String(
                date
            ),

        time:

            normalizeTime(
                time
            ),

        pastor:

            String(
                meeting.pastor || ""
            ),

        people:

            Number(
                meeting.people || 0
            ),

        observations:

            String(
                meeting.observations || ""
            )

    };

}


/* =========================================
   NORMALIZAR HORÁRIO
========================================= */

function normalizeTime(
    time
) {

    if (!time) {
        return "";
    }


    const text =
        String(
            time
        ).trim();


    const match =
        text.match(
            /^(\d{1,2}):(\d{2})/
        );


    if (!match) {
        return text;
    }


    return (

        String(
            match[1]
        ).padStart(
            2,
            "0"
        ) +

        ":" +

        match[2]

    );

}


/* =========================================
   PASTORES
========================================= */

function initializePastors() {

    if (
        localStorage.getItem(
            "pastores"
        ) === null
    ) {

        localStorage.setItem(

            "pastores",

            JSON.stringify(
                defaultPastors
            )

        );

    }

}


function getPastors() {

    return pastorsCache.slice();

}


function savePastors(
    pastors
) {

    pastorsCache =
        Array.isArray(
            pastors
        )
            ? pastors.slice()
            : [];


    localStorage.setItem(

        "pastores",

        JSON.stringify(
            pastorsCache
        )

    );

}


function loadPastorSelect(
    selectedPastor = ""
) {

    const select =
        document.getElementById(
            "pastor"
        );


    if (!select) {
        return;
    }


    const pastors =
        getPastors();


    select.innerHTML = `

        <option value="">
            Selecione o pastor
        </option>

    `;


    pastors.forEach(
        pastor => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                pastor;


            option.textContent =
                pastor;


            if (
                pastor ===
                selectedPastor
            ) {

                option.selected =
                    true;

            }


            select.appendChild(
                option
            );

        }
    );

}


/* =========================================
   MODAL DE PASTORES
========================================= */

function openPastorModal() {

    const modal =
        document.getElementById(
            "pastorModal"
        );


    if (!modal) {
        return;
    }


    renderPastorList();


    modal.classList.remove(
        "hidden"
    );


    const input =
        document.getElementById(
            "newPastor"
        );


    if (input) {

        setTimeout(
            () => input.focus(),
            100
        );

    }

}


function closePastorModal() {

    const modal =
        document.getElementById(
            "pastorModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


/* =========================================
   ADICIONAR PASTOR
========================================= */

async function addPastor() {

    const input =
        document.getElementById(
            "newPastor"
        );


    if (!input) {
        return;
    }


    const name =
        input.value.trim();


    if (!name) {
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
            "Este pastor já está cadastrado."
        );


        input.focus();

        return;

    }


    try {

        const result =
            await apiPost({

                action:
                    "savePastor",

                name:
                    name

            });


        if (
            result.duplicate
        ) {

            alert(
                "Este pastor já está cadastrado."
            );

            return;

        }


        pastorIdsCache[name] =
            result.id;


        pastors.push(
            name
        );


        savePastors(
            pastors
        );


        input.value = "";


        renderPastorList();

        loadPastorSelect();


        try {

            const cloud =
                await apiGet(
                    "getPastors"
                );


            lastCloudPastorsSignature =
                createPastorsSignature(
                    cloud.pastors || []
                );

        } catch (error) {

            console.warn(
                "Não foi possível atualizar assinatura dos pastores:",
                error
            );

        }


        input.focus();


    } catch (error) {

        console.warn(
            "Erro ao salvar pastor na nuvem:",
            error
        );


        alert(
            "Não foi possível salvar o pastor no Google Sheets."
        );

    }

}


/* =========================================
   LISTA DE PASTORES
========================================= */

function renderPastorList() {

    const container =
        document.getElementById(
            "pastorList"
        );


    if (!container) {
        return;
    }


    const pastors =
        getPastors();


    if (!pastors.length) {

        container.innerHTML = `

            <div class="empty-pastors">

                Nenhum pastor cadastrado.

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    pastors.forEach(
        (
            pastor,
            index
        ) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "pastor-item";


            item.innerHTML = `

                <span
                    class="pastor-item-name"
                >

                    ${escapeHtml(
                        pastor
                    )}

                </span>


                <button
                    type="button"
                    class="delete-pastor"
                    onclick="deletePastor(${index})"
                >

                    Excluir

                </button>

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* =========================================
   EXCLUIR PASTOR
========================================= */

async function deletePastor(
    index
) {

    const pastors =
        getPastors();


    if (
        !pastors[index]
    ) {

        return;

    }


    const name =
        pastors[index];


    const confirmed =
        confirm(

            `Deseja excluir o pastor "${name}"?`

        );


    if (!confirmed) {
        return;
    }


    const pastorId =
        pastorIdsCache[name];


    if (!pastorId) {

        alert(
            "Não foi possível localizar o ID deste pastor no Google Sheets."
        );

        return;

    }


    try {

        /*
           O Apps Script deverá alterar
           Ativo para FALSE.
        */

        await apiPost({

            action:
                "deletePastor",

            id:
                pastorId

        });


        /*
           Remove apenas da interface.
        */

        pastors.splice(
            index,
            1
        );


        delete pastorIdsCache[name];


        savePastors(
            pastors
        );


        renderPastorList();

        loadPastorSelect();


        try {

            const cloud =
                await apiGet(
                    "getPastors"
                );


            lastCloudPastorsSignature =
                createPastorsSignature(
                    cloud.pastors || []
                );

        } catch (error) {

            console.warn(
                "Erro ao atualizar pastores:",
                error
            );

        }


    } catch (error) {

        console.warn(
            "Erro ao excluir pastor:",
            error
        );


        alert(
            "Não foi possível excluir o pastor no Google Sheets."
        );

    }

}


/* =========================================
   UTILITÁRIO
========================================= */

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


/* =========================================
   DATA ATUAL
========================================= */

function getToday() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


/* =========================================
   HORÁRIOS DO DIA
========================================= */

function getMeetingTimesForDate(
    dateString
) {

    if (!dateString) {

        dateString =
            getToday();

    }


    const date =
        new Date(
            dateString +
            "T12:00:00"
        );


    const dayOfWeek =
        date.getDay();


    return (

        meetingSchedules[
            dayOfWeek
        ] || []

    );

}


/* =========================================
   CONVERSÃO DE HORÁRIO
========================================= */

function timeToMinutes(
    time
) {

    const [
        hour,
        minute
    ] =
        time
            .split(":")
            .map(Number);


    return (
        hour * 60 +
        minute
    );

}


/* =========================================
   HORÁRIO ATUAL
========================================= */

function getCurrentMeetingTime(
    dateString = getToday()
) {

    if (
        dateString !==
        getToday()
    ) {

        return null;

    }


    const times =
        getMeetingTimesForDate(
            dateString
        );


    if (!times.length) {
        return null;
    }


    const now =
        new Date();


    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();


    const firstMeetingMinutes =
        timeToMinutes(
            times[0]
        );


    if (
        currentMinutes <
        firstMeetingMinutes
    ) {

        return times[0];

    }


    for (
        let i = 0;
        i < times.length;
        i++
    ) {

        const startMinutes =
            timeToMinutes(
                times[i]
            );


        const nextMeeting =
            times[i + 1];


        if (nextMeeting) {

            const nextMinutes =
                timeToMinutes(
                    nextMeeting
                );


            if (

                currentMinutes >=
                startMinutes &&

                currentMinutes <
                nextMinutes

            ) {

                return times[i];

            }

        } else {

            if (
                currentMinutes >=
                startMinutes
            ) {

                return times[i];

            }

        }

    }


    return null;

}


/* =========================================
   STATUS
========================================= */

function getMeetingStatus(
    dateString,
    meetingTime
) {

    const today =
        getToday();


    if (
        dateString >
        today
    ) {

        return "future";

    }


    if (
        dateString <
        today
    ) {

        const meeting =
            getMeeting(
                dateString,
                meetingTime
            );


        if (meeting) {

            return "filled";

        }


        return "pending";

    }


    const meeting =
        getMeeting(
            dateString,
            meetingTime
        );


    if (meeting) {

        return "filled";

    }


    const currentMeeting =
        getCurrentMeetingTime(
            dateString
        );


    if (!currentMeeting) {

        return "future";

    }


    const times =
        getMeetingTimesForDate(
            dateString
        );


    const currentIndex =
        times.indexOf(
            currentMeeting
        );


    const meetingIndex =
        times.indexOf(
            meetingTime
        );


    if (
        meetingTime ===
        currentMeeting
    ) {

        return "current";

    }


    if (
        meetingIndex <
        currentIndex
    ) {

        return "pending";

    }


    return "future";

}


/* =========================================
   REUNIÕES
========================================= */

function getMeetings() {

    return meetingsCache.slice();

}


function saveMeetings(
    meetings
) {

    meetingsCache =
        Array.isArray(
            meetings
        )
            ? meetings.map(
                normalizeMeeting
            )
            : [];


    localStorage.setItem(

        "reunioes",

        JSON.stringify(
            meetingsCache
        )

    );

}


function getMeeting(
    dateString,
    time
) {

    return getMeetings().find(

        meeting =>

            meeting.date ===
            dateString &&

            meeting.time ===
            time

    );

}


/* =========================================
   TELA DE REUNIÕES
========================================= */

let selectedDate =
    getToday();


function updateDateLabels() {

    const formatted =
        formatDateWithWeekday(
            selectedDate
        );


    const currentDateLabel =
        document.getElementById(
            "currentDateLabel"
        );


    if (currentDateLabel) {

        currentDateLabel.textContent =
            formatted;

    }


    const selectedDateText =
        document.getElementById(
            "selectedDateText"
        );


    if (selectedDateText) {

        selectedDateText.textContent =
            formatted;

    }

}


/* =========================================
   FORMATAÇÃO DA DATA
========================================= */

function formatDateWithWeekday(
    dateString
) {

    const date =
        new Date(
            dateString +
            "T12:00:00"
        );


    const weekdays = [

        "Domingo",

        "Segunda-feira",

        "Terça-feira",

        "Quarta-feira",

        "Quinta-feira",

        "Sexta-feira",

        "Sábado"

    ];


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const year =
        date.getFullYear();


    return `${day}/${month}/${year} — ${weekdays[date.getDay()]}`;

}


/* =========================================
   TIMELINE
========================================= */

function renderTimeline() {

    const timeline =
        document.getElementById(
            "timeline"
        );


    if (!timeline) {
        return;
    }


    const times =
        getMeetingTimesForDate(
            selectedDate
        );


    timeline.innerHTML = "";


    times.forEach(
        time => {

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


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                `timeline-item status-${status}`;


            let statusText = "";


            if (
                status ===
                "filled"
            ) {

                statusText =
                    "Preenchida";

            }


            if (
                status ===
                "pending"
            ) {

                statusText =
                    "Pendente";

            }


            if (
                status ===
                "current"
            ) {

                statusText =
                    "Atual";

            }


            if (
                status ===
                "future"
            ) {

                statusText =
                    "Próxima";

            }


            const people =
                meeting

                    ? `${meeting.people || 0} pessoas`

                    : "";


            const pastor =
                meeting &&
                meeting.pastor

                    ? meeting.pastor

                    : "";


            item.innerHTML = `

                <div
                    class="timeline-status"
                ></div>


                <div
                    class="timeline-content"
                >

                    <div
                        class="timeline-time"
                    >

                        ${formatTime(
                            time
                        )}

                    </div>


                    <div
                        class="timeline-status-text"
                    >

                        ${statusText}

                    </div>


                    <div
                        class="timeline-people"
                    >

                        ${people}

                    </div>


                    <div
                        class="timeline-pastor"
                    >

                        ${escapeHtml(
                            pastor
                        )}

                    </div>

                </div>

            `;


            item.addEventListener(

                "click",

                () =>
                    openMeeting(
                        time
                    )

            );


            timeline.appendChild(
                item
            );

        }
    );


    updateDateLabels();

    updateSummary();

}


/* =========================================
   FORMATAÇÃO DO HORÁRIO
========================================= */

function formatTime(
    time
) {

    if (!time) {
        return "";
    }


    const [
        hour,
        minute
    ] =
        time.split(":");


    return `${hour}:${minute}`;

}


/* =========================================
   ABRIR REUNIÃO
========================================= */

function openMeeting(
    time
) {

    const modal =
        document.getElementById(
            "meetingModal"
        );


    if (!modal) {
        return;
    }


    const meeting =
        getMeeting(
            selectedDate,
            time
        );


    const modalMeetingTime =
        document.getElementById(
            "modalMeetingTime"
        );


    const modalMeetingDate =
        document.getElementById(
            "modalMeetingDate"
        );


    if (modalMeetingTime) {

        modalMeetingTime.textContent =
            formatTime(
                time
            );

    }


    if (modalMeetingDate) {

        modalMeetingDate.textContent =
            formatDateWithWeekday(
                selectedDate
            );

    }


    loadPastorSelect(

        meeting
            ? meeting.pastor
            : ""

    );


    const peopleInput =
        document.getElementById(
            "people"
        );


    const observationsInput =
        document.getElementById(
            "observations"
        );


    if (peopleInput) {

        peopleInput.value =

            meeting

                ? meeting.people

                : "";

    }


    if (observationsInput) {

        observationsInput.value =

            meeting

                ? meeting.observations ||
                  ""

                : "";

    }


    modal.dataset.time =
        time;


    modal.classList.remove(
        "hidden"
    );

}


/* =========================================
   FECHAR REUNIÃO
========================================= */

function closeMeeting() {

    const modal =
        document.getElementById(
            "meetingModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


function closeMeetingModal() {

    closeMeeting();

}


/* =========================================
   SALVAR REUNIÃO
========================================= */

async function saveMeeting() {

    /*
       BLOQUEIA A SINCRONIZAÇÃO AUTOMÁTICA
       DURANTE O SALVAMENTO.
    */

    meetingSaveInProgress = true;


    const modal =
        document.getElementById(
            "meetingModal"
        );


    if (!modal) {

        meetingSaveInProgress = false;

        return;

    }


    const time =
        normalizeTime(
            modal.dataset.time
        );


    if (!time) {

        meetingSaveInProgress = false;

        return;

    }


    const pastorInput =
        document.getElementById(
            "pastor"
        );


    const peopleInput =
        document.getElementById(
            "people"
        );


    const observationsInput =
        document.getElementById(
            "observations"
        );


    const pastor =
        pastorInput
            ? pastorInput.value.trim()
            : "";


    const people =
        peopleInput
            ? Number(
                peopleInput.value
            ) || 0
            : 0;


    const observations =
        observationsInput
            ? observationsInput.value.trim()
            : "";


    /*
       Verifica se já existe.
    */

    const existing =
        getMeeting(
            selectedDate,
            time
        );


    /*
       Mantém o ID existente.

       Para nova reunião utiliza
       um ID temporário.
    */

    const record =
        normalizeMeeting({

            id:

                existing
                    ? existing.id
                    : `${selectedDate}_${time}`,

            date:
                selectedDate,

            time:
                time,

            pastor:
                pastor,

            people:
                people,

            observations:
                observations

        });


    /*
       Atualiza imediatamente a tela.
    */

    const meetings =
        getMeetings();


    const existingIndex =
        meetings.findIndex(

            meeting =>

                meeting.date ===
                selectedDate &&

                meeting.time ===
                time

        );


    if (
        existingIndex >= 0
    ) {

        meetings[
            existingIndex
        ] =
            record;

    } else {

        meetings.push(
            record
        );

    }


    saveMeetings(
        meetings
    );


    /*
       Marca o momento da alteração.
    */

    lastLocalMeetingChange =
        Date.now();


    /*
       Atualiza a assinatura local.
    */

    lastCloudMeetingsSignature =
        createMeetingsSignature(
            meetingsCache
        );


    closeMeeting();

    renderTimeline();

    updateSummary();


    /*
       Envia para o Google Sheets.
    */

    try {

        const result =
            await apiPost({

                action:
                    "saveMeeting",

                id:
                    record.id,

                date:
                    record.date,

                day:
                    getWeekdayName(
                        record.date
                    ),

                time:
                    record.time,

                people:
                    record.people,

                pastor:
                    record.pastor,

                observations:
                    record.observations

            });


        /*
           Atualiza o ID temporário pelo
           ID numérico real do Sheets.
        */

        if (
            result &&
            result.id !== undefined &&
            result.id !== null
        ) {

            const updatedMeetings =
                getMeetings();


            const updatedIndex =
                updatedMeetings.findIndex(

                    meeting =>

                        meeting.date ===
                        record.date &&

                        meeting.time ===
                        record.time

                );


            if (
                updatedIndex >= 0
            ) {

                updatedMeetings[
                    updatedIndex
                ].id =
                    String(
                        result.id
                    );


                saveMeetings(
                    updatedMeetings
                );


                lastCloudMeetingsSignature =
                    createMeetingsSignature(
                        updatedMeetings
                    );

            }

        }


        renderTimeline();

        updateSummary();


        console.log(
            "Reunião sincronizada com o Google Sheets.",
            result
        );


    } catch (error) {

        console.warn(

            "Erro ao sincronizar reunião:",
            error

        );


        alert(

            "Não foi possível sincronizar a reunião com o Google Sheets."

        );

    } finally {

        /*
           Libera novamente a sincronização
           automática.
        */

        meetingSaveInProgress = false;

    }

}


/* =========================================
   ATUALIZAR REUNIÕES DA NUVEM
========================================= */

async function refreshMeetingsFromCloud() {

    /*
       Não atualiza enquanto uma reunião
       estiver sendo salva.
    */

    if (meetingSaveInProgress) {
        return false;
    }


    if (cloudSyncInProgress) {
        return false;
    }


    cloudSyncInProgress = true;


    try {

        const data =
            await apiGet(
                "getMeetings"
            );


        /*
           A resposta precisa realmente
           conter um ARRAY.
        */

        if (
            !data ||
            data.success !== true ||
            !Array.isArray(
                data.meetings
            )
        ) {

            console.warn(
                "Resposta inválida do Google Sheets."
            );

            return false;

        }


        const cloudMeetings =
            data.meetings.map(
                normalizeMeeting
            );


        /*
           Se o Sheets retornar reuniões,
           sincroniza normalmente.
        */

        if (
            cloudMeetings.length > 0
        ) {

            const timeSinceLocalChange =
                Date.now() -
                lastLocalMeetingChange;


            /*
               Evita sobrescrever uma alteração
               recém-realizada.
            */

            if (
                timeSinceLocalChange >= 5000
            ) {

                meetingsCache =
                    cloudMeetings;


                saveMeetings(
                    meetingsCache
                );


                lastCloudMeetingsSignature =
                    createMeetingsSignature(
                        cloudMeetings
                    );


                renderTimeline();

                updateSummary();

            }


            return true;

        }


        /*
           =====================================
           PROTEÇÃO CONTRA RESPOSTA VAZIA
           =====================================

           Se já temos reuniões no sistema,
           NÃO substituímos por [].
        */

        if (
            meetingsCache.length > 0
        ) {

            console.warn(
                "Google Sheets retornou vazio. Os dados atuais foram preservados."
            );


            return true;

        }


        /*
           Só aceita lista vazia quando
           o sistema realmente já está vazio.
        */

        lastCloudMeetingsSignature =
            "";


        return true;


    } catch (error) {

        console.warn(
            "Erro ao atualizar reuniões:",
            error
        );


        /*
           Em caso de erro, mantém os dados
           atuais da tela.
        */

        return false;


    } finally {

        cloudSyncInProgress = false;

    }

}


/* =========================================
   DATA
========================================= */

function openDatePicker() {

    const modal =
        document.getElementById(
            "dateModal"
        );


    const input =
        document.getElementById(
            "datePicker"
        );


    if (
        !modal ||
        !input
    ) {

        return;

    }


    const today =
        getToday();


    input.max =
        today;


    input.value =
        selectedDate;


    modal.classList.remove(
        "hidden"
    );

}


function closeDatePicker() {

    const modal =
        document.getElementById(
            "dateModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


function applyDate() {

    const input =
        document.getElementById(
            "datePicker"
        );


    if (
        !input ||
        !input.value
    ) {

        return;

    }


    const selectedValue =
        input.value;


    const today =
        getToday();


    if (
        selectedValue >
        today
    ) {

        return;

    }


    selectedDate =
        selectedValue;


    closeDatePicker();

    updateDateLabels();

    renderTimeline();

    updateSummary();

}


/* =========================================
   RESUMO DO DIA
========================================= */

function updateSummary() {

    const times =
        getMeetingTimesForDate(
            selectedDate
        );


    let filled = 0;

    let peopleTotal = 0;


    times.forEach(
        time => {

            const meeting =
                getMeeting(
                    selectedDate,
                    time
                );


            if (meeting) {

                filled++;


                peopleTotal +=

                    Number(
                        meeting.people
                    ) || 0;

            }

        }
    );


    const totalMeetings =
        document.getElementById(
            "totalMeetings"
        );


    const filledMeetings =
        document.getElementById(
            "filledMeetings"
        );


    const pendingMeetings =
        document.getElementById(
            "pendingMeetings"
        );


    const peopleTotalElement =
        document.getElementById(
            "peopleTotal"
        );


    if (totalMeetings) {

        totalMeetings.textContent =
            times.length;

    }


    if (filledMeetings) {

        filledMeetings.textContent =
            filled;

    }


    if (pendingMeetings) {

        pendingMeetings.textContent =
            times.length -
            filled;

    }


    if (peopleTotalElement) {

        peopleTotalElement.textContent =
            peopleTotal;

    }

}


/* =========================================
   RELATÓRIOS
========================================= */

function initializeReports() {

    const start =
        document.getElementById(
            "reportStart"
        );


    const end =
        document.getElementById(
            "reportEnd"
        );


    if (
        start &&
        !start.value
    ) {

        start.value =
            getToday();

    }


    if (
        end &&
        !end.value
    ) {

        end.value =
            getToday();

    }


    renderReports();

}


/* =========================================
   GERAR RELATÓRIO
========================================= */

async function generateReport() {

    await refreshMeetingsFromCloud();

    renderReports();

}


/* =========================================
   RELATÓRIOS
========================================= */

function renderReports() {

    const startInput =
        document.getElementById(
            "reportStart"
        );


    const endInput =
        document.getElementById(
            "reportEnd"
        );


    if (
        !startInput ||
        !endInput
    ) {

        return;

    }


    const start =
        startInput.value;


    const end =
        endInput.value;


    if (
        !start ||
        !end
    ) {

        return;

    }


    const meetings =
        getMeetings()

            .filter(

                meeting =>

                    meeting.date >=
                    start &&

                    meeting.date <=
                    end

            );


    const totalMeetings =
        meetings.length;


    const totalPeople =
        meetings.reduce(

            (
                total,
                meeting
            ) =>

                total +

                (
                    Number(
                        meeting.people
                    ) || 0
                ),

            0

        );


    const average =
        totalMeetings

            ? totalPeople /
              totalMeetings

            : 0;


    const days =
        new Set(

            meetings.map(
                meeting =>
                    meeting.date
            )

        ).size;


    const reportMeetings =
        document.getElementById(
            "reportMeetings"
        );


    const reportPeople =
        document.getElementById(
            "reportPeople"
        );


    const reportAverage =
        document.getElementById(
            "reportAverage"
        );


    const reportDays =
        document.getElementById(
            "reportDays"
        );


    if (reportMeetings) {

        reportMeetings.textContent =
            totalMeetings;

    }


    if (reportPeople) {

        reportPeople.textContent =
            totalPeople;

    }


    if (reportAverage) {

        reportAverage.textContent =
            average.toFixed(
                1
            );

    }


    if (reportDays) {

        reportDays.textContent =
            days;

    }


    renderReportTable(
        meetings
    );

}


/* =========================================
   TABELA DO RELATÓRIO
========================================= */

function renderReportTable(
    meetings
) {

    const tbody =
        document.getElementById(
            "reportTableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (!meetings.length) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    style="text-align:center;"
                >

                    Nenhuma reunião encontrada
                    no período.

                </td>

            </tr>

        `;

        return;

    }


    meetings.sort(
        (a, b) => {

            if (
                a.date !==
                b.date
            ) {

                return a.date.localeCompare(
                    b.date
                );

            }


            return a.time.localeCompare(
                b.time
            );

        }
    );


    meetings.forEach(
        meeting => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>

                    ${formatDateOnly(
                        meeting.date
                    )}

                </td>


                <td>

                    ${formatTime(
                        meeting.time
                    )}

                </td>


                <td>

                    ${escapeHtml(
                        meeting.pastor ||
                        "-"
                    )}

                </td>


                <td>

                    ${meeting.people || 0}

                </td>


                <td>

                    ${escapeHtml(
                        meeting.observations ||
                        "-"
                    )}

                </td>


                <td>

                    <button

                        class="edit-table-button"

                        onclick="editReportMeeting(
                            '${meeting.date}',
                            '${meeting.time}'
                        )"

                    >

                        Editar

                    </button>

                </td>

            `;


            tbody.appendChild(
                row
            );

        }
    );

}


/* =========================================
   EDITAR PELO RELATÓRIO
========================================= */

function editReportMeeting(
    date,
    time
) {

    selectedDate =
        date;


    updateDateLabels();

    renderTimeline();


    showScreen(
        "meetingsScreen"
    );


    setTimeout(
        () => {

            openMeeting(
                time
            );

        },
        50
    );

}


/* =========================================
   DATA SIMPLES
========================================= */

function formatDateOnly(
    dateString
) {

    const [
        year,
        month,
        day
    ] =
        dateString.split("-");


    return `${day}/${month}/${year}`;

}


/* =========================================
   NAVEGAÇÃO
========================================= */

function showScreen(
    screenId
) {

    const screens =
        document.querySelectorAll(
            ".screen"
        );


    screens.forEach(
        screen => {

            screen.classList.add(
                "hidden"
            );

        }
    );


    const screen =
        document.getElementById(
            screenId
        );


    if (screen) {

        screen.classList.remove(
            "hidden"
        );

    }


    /*
       Ao entrar em reuniões,
       fazemos uma consulta pontual.
    */

    if (
        screenId ===
        "meetingsScreen"
    ) {

        updateDateLabels();

        renderTimeline();

        updateSummary();


        refreshMeetingsFromCloud();

    }


    /*
       Ao entrar em relatórios,
       fazemos uma consulta pontual.
    */

    if (
        screenId ===
        "reportsScreen"
    ) {

        renderReports();


        refreshMeetingsFromCloud()

            .then(
                () =>
                    renderReports()
            );

    }

}


/* =========================================
   CLIQUE FORA DOS MODAIS
========================================= */

document.addEventListener(
    "click",
    event => {

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

            dateModal &&

            event.target ===
            dateModal

        ) {

            closeDatePicker();

        }


        if (

            meetingModal &&

            event.target ===
            meetingModal

        ) {

            closeMeeting();

        }


        if (

            pastorModal &&

            event.target ===
            pastorModal

        ) {

            closePastorModal();

        }

    }
);


/* =========================================
   TECLA ENTER — CADASTRAR PASTOR
========================================= */

document.addEventListener(
    "keydown",
    event => {

        if (

            event.key ===
            "Enter" &&

            document.activeElement &&

            document.activeElement.id ===
            "newPastor"

        ) {

            event.preventDefault();

            addPastor();

        }

    }
);


/* =========================================
   DIA DA SEMANA
========================================= */

function getWeekdayName(
    dateString
) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            dateString +
            "T12:00:00"
        );


    const weekdays = [

        "Domingo",

        "Segunda-feira",

        "Terça-feira",

        "Quarta-feira",

        "Quinta-feira",

        "Sexta-feira",

        "Sábado"

    ];


    return (
        weekdays[
            date.getDay()
        ] || ""
    );

}
