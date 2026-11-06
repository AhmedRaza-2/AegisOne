# URL evaluation - v9_alone

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 5.40%, BLOCK(>=60) 4.80%
- openphish_fresh (n=300): recall WARN 93.3%, BLOCK 88.7%
  - final: AUC 0.958 | TPR@FPR 1% 15.3%, 0.1% 15.3% | AP@1% base rate 0.249
  - neural: AUC 0.875 | TPR@FPR 1% 60.7%, 0.1% 7.3% | AP@1% base rate 0.393
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.992 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.225
  - neural: AUC 0.008 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 78.3%, BLOCK 73.7%
  - final: AUC 0.922 | TPR@FPR 1% 13.3%, 0.1% 13.3% | AP@1% base rate 0.211
  - neural: AUC 0.844 | TPR@FPR 1% 45.0%, 0.1% 0.3% | AP@1% base rate 0.236

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
- 0.96  https://businessfinder.oregonlive.com/duvall-a-l-dvm-valley-veterinary-clinic-rainier-or.html
- 0.96  http://www.uninstallerfix.com/uninstall-errors/how-to-uninstall-quilters-39-polygons-template-pack-guide.html
- 0.96  http://100resilientcities.org/why-rebuild-by-design-succeeds/
- 0.96  https://citizen.co.za/news/1366619/five-killed-in-toll-road-shootout/
- 0.96  https://steamdiscovery.com/982370/steamgame/line-dance-virtual/
- 0.96  https://docs.citrix.com/en-us/netscaler/12/clustering/cluster-overview/cluster-config-sync-concepts.html
- 0.96  http://www.growingupdisney.com/2015/10/spot-it-disney-frozen-game-review.html
- 0.96  https://www.livecareer.com/resume-search/r/-9777bcc4441844e380db329d5ee3653c