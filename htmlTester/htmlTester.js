$(document).ready(function() {
    $("#tryItButton").click(function() {
        var htmlCode = $("#htmlInput").val();
        $("#htmlPanel").html(htmlCode);
    });
});