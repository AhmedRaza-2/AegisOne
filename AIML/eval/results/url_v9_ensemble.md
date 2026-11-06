# URL evaluation - v9_ensemble

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 5.00%, BLOCK(>=60) 4.45%
- openphish_fresh (n=300): recall WARN 87.3%, BLOCK 79.7%
  - final: AUC 0.953 | TPR@FPR 1% 14.3%, 0.1% 14.3% | AP@1% base rate 0.238
  - neural: AUC 0.870 | TPR@FPR 1% 59.7%, 0.1% 15.3% | AP@1% base rate 0.460
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.992 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.225
  - neural: AUC 0.008 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 45.0%, BLOCK 37.3%
  - final: AUC 0.856 | TPR@FPR 1% 6.7%, 0.1% 6.7% | AP@1% base rate 0.116
  - neural: AUC 0.775 | TPR@FPR 1% 19.0%, 0.1% 0.0% | AP@1% base rate 0.075

Worst false positives (legit_popular):
- 0.96  https://www.olx.com.pk/90-chitti-road_g8828/cars_c84?filter=color_eq_15%2Cregistration_city_eq_lahore
- 0.96  https://www.olx.com.pk/7th-avenue_g5000901/other-jobs_c65
- 0.96  https://www.psx.com.pk/blog/index.php/2021/11/11/nit-pakistan-gateway-index-a-performance-analysis-since-launch/
- 0.96  https://www.olx.com.pk/100-quarters_g5000084/bikes-sports-heavy-bikes_c707034
- 0.96  https://www.psx.com.pk/blog/index.php/tag/nit-etf/
- 0.96  https://www.psx.com.pk/psx/events-psx/20-years-of-cfasp-celebrated-at-psx-with-a-gong-ceremony
- 0.96  https://chasevalue.pk/collections/beauty-personal-care-beauty-tools/products/beauty-pouch-blue-chase-value-a138645-a-blue-257790
- 0.96  https://www.olx.com.pk/204-chak-road_g9511/catering-restaurant_c2047/q-catering

Worst false positives (legit_web):
- 0.96  http://100resilientcities.org/why-rebuild-by-design-succeeds/
- 0.96  https://citizen.co.za/news/1366619/five-killed-in-toll-road-shootout/
- 0.96  http://www.pmlive.com/tags/monoclonal_antibody_drugs
- 0.96  https://thevinchaser.com/bdc-helper
- 0.96  https://disneyparksmomspanel.disney.go.com/question/hidoes-anyone-know-disney-app-blackberry-seen-app-phones-240167/
- 0.96  https://www.livecareer.com/resume-search/r/certified-nursing-assistant-8abbc85d853e4ccb9be73d4f4b14d31d
- 0.96  http://googleylessons.com/blog/irce2012/
- 0.96  https://businessfinder.oregonlive.com/duvall-a-l-dvm-valley-veterinary-clinic-rainier-or.html