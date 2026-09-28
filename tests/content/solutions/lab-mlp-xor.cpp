double forward(const Network& net, double x1, double x2, vector<double>& h) {
    h.assign(4, 0.0);
    double z = net.b2;
    for (int j = 0; j < 4; j++) {
        h[j] = tanh(net.W1[j][0] * x1 + net.W1[j][1] * x2 + net.b1[j]);
        z += net.W2[j] * h[j];
    }
    return 1 / (1 + exp(-z));
}

Network trainXOR() {
    const double X[4][2] = {{0, 0}, {0, 1}, {1, 0}, {1, 1}};
    const double Y[4] = {0, 1, 1, 0};
    Network net;
    net.W1 = {{0.5, -0.4}, {0.3, 0.8}, {-0.6, 0.2}, {0.7, -0.3}};
    net.b1 = {0.1, -0.2, 0.05, 0.15};
    net.W2 = {0.4, -0.5, 0.6, 0.3};
    net.b2 = 0.05;
    const double lr = 0.5;
    const int epochs = 4000;
    vector<double> h;
    for (int e = 0; e < epochs; e++) {
        double loss = 0;
        for (int s = 0; s < 4; s++) {
            double p = forward(net, X[s][0], X[s][1], h);
            loss += (p - Y[s]) * (p - Y[s]);
            double dz = 2 * (p - Y[s]) * p * (1 - p);
            for (int j = 0; j < 4; j++) {
                double dpre = dz * net.W2[j] * (1 - h[j] * h[j]);
                net.W2[j] -= lr * dz * h[j];
                net.W1[j][0] -= lr * dpre * X[s][0];
                net.W1[j][1] -= lr * dpre * X[s][1];
                net.b1[j] -= lr * dpre;
            }
            net.b2 -= lr * dz;
        }
        net.lossHistory.push_back(loss / 4);
    }
    return net;
}
