$body = '{"score":550,"subjectCombination":"物理,化学,生物","region":"河南","targetRegion":""}';
$resp = Invoke-RestMethod -Uri "http://localhost:3000/api/recommend-from-db" -Method POST -Body $body -ContentType "application/json";
Write-Host "总条数: $($resp.data.Count)";
if ($resp.data.Count -gt 0) {
    $resp.data[0..2] | ForEach-Object { Write-Host "  $($_.name) - $($_.major) | 分:$($_.score) | 选科:$($_.subject_require) | P$($_.matchPriority)" }
}
