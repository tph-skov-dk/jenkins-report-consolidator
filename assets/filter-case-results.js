function updateCaseVisibility(checked) {
    const items = document.querySelectorAll(
        "report-grid case[success]",
    );
    const style = checked ? "none" : "";
    for (const item of items) {
        item.style.display = style;
    }
}

function main() {
    const filter = document.querySelector("#only-bad");
    filter.addEventListener("input", () => {
        updateCaseVisibility(filter.checked);
    });
    updateCaseVisibility(filter.checked);
}
main();
