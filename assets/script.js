function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function updateCaseVisibility(checked) {
    const cases = document.querySelectorAll(
        "report-grid case[success]",
    );
    for (const item of cases) {
        if (checked) {
            item.style.setProperty("display", "none");
        } else {
            item.style.removeProperty("display");
        }
    }
    const reports = document.querySelectorAll(
        "report-grid report",
    );
    for (const report of reports) {
        if (!checked) {
            report.style.removeProperty("display");
            continue;
        }
        const cases = report.querySelectorAll("case");
        const isAllSuccess = cases
            .entries()
            .every(([, x]) => x.getAttribute("success") !== null);
        if (isAllSuccess) {
            report.style.setProperty("display", "none");
        }
    }
}

function initializeCaseTypeFilter() {
    const filter = document.querySelector("#only-bad");
    filter.addEventListener("input", () => {
        updateCaseVisibility(filter.checked);
    });
    updateCaseVisibility(filter.checked);
}

function initializeDetailsButtons() {
    const dialog = document.querySelector("#case-details-dialog");
    const dialogClose = document.querySelector(
        "#case-details-dialog-close",
    );
    const dialogContent = document.querySelector(
        "#case-details-dialog-content",
    );

    dialogClose.addEventListener("click", () => {
        dialog.close();
    });
    for (const item of document.querySelectorAll("case-details-button")) {
        item.addEventListener("click", () => {
            const data = JSON.parse(item.getAttribute("case-data"));
            dialogContent.innerHTML = `<p>Message: ${
                data.message ? `'${escapeHtml(data.message)}'` : "None"
            }</p><hr><p>Trace: ${
                data.trace
                    ? `<pre trace>${escapeHtml(data.trace)}</pre>`
                    : "None"
            }</p>`;
            if (data.result === "skipped") {
                dialogContent.innerHTML = `<p>Type: '${data.type}'</p><hr>` +
                    dialogContent.innerHTML;
            }
            dialog.showModal();
        });
    }
}

function main() {
    initializeCaseTypeFilter();
    initializeDetailsButtons();
}
main();
