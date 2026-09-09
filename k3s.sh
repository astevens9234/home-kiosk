docker build -t home-kiosk:latest .

docker save home-kiosk:latest -o home-kiosk.tar

sudo k3s ctr images import home-kiosk.tar

kubectl apply -f k8s/kiosk-deployment.yaml
