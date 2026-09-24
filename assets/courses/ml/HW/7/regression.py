import numpy as np
import progressbar
import cvxopt
import pandas as pd
import tensorflow as tf
import cvxpy as cp

cvxopt.solvers.options['show_progress'] = False

widgets = ['Model Training: ', progressbar.Percentage(), ' ',
            progressbar.Bar(marker="-", left="[", right="]"),
            ' ', progressbar.ETA()]


class DecisionNode:
    def __init__(self, feature_id=None, threshold=None,
                 value=None, true_branch=None, false_branch=None):
        self.feature_id = feature_id
        self.threshold = threshold
        self.value = value
        self.true_branch = true_branch
        self.false_branch = false_branch



class RegressionTree:
   def __init__(self, min_samples_split=2, min_impurity=1e-7, max_depth=float("inf")):
       self.min_samples_split = min_samples_split
       self.min_impurity = min_impurity
       self.max_depth = max_depth



   def calculate_purity_gain(self, y, y1, y2):

       pure_gain = np.var(y) - (len(y1) / len(y) * np.var(y1) + len(y2) / len(y) * np.var(y2))
       return pure_gain

   def divide_on_feature(self, X, y, feature_id, threshold):

       if isinstance(threshold, int) or isinstance(threshold, float):
           true_indices = X[:, feature_id] >= threshold
       else:
           true_indices = X[:, feature_id] == threshold

       X_1, y_1 = X[true_indices], y[true_indices]
       X_2, y_2 = X[~true_indices], y[~true_indices]
       return X_1, y_1, X_2, y_2

   def majority_vote(self, y):

       return np.mean(y)

   def fit(self, X, y):
       X = np.array(X)
       y = np.array(y)
       self.root = self.grow_tree(X, y)

   def grow_tree(self, X, y, current_depth=0):


       largest_purity_gain = 0

       nr_samples, nr_features = np.shape(X)

       # checking if we have reached the pre-specified limits
       if nr_samples >= self.min_samples_split and current_depth <= self.max_depth:

           # go over the features to select the one that gives more purity
           for feature_id in range(nr_features):

               unique_values = np.unique(X[:, feature_id])

               # we iterate through all unique values of feature column and
               # calculate the impurity
               for threshold in unique_values:

                   # Divide X and y according to the condition
                   # if the feature value of X at index feature_id
                   # meets the threshold
                   X1, y1, X2, y2 = self.divide_on_feature(X, y, feature_id, threshold)

                   # checking if we have samples in each subtree
                   if len(X1) > 0 and len(X2) > 0:
                       # calculate purity gain for the split
                       purity_gain = self.calculate_purity_gain(y, y1, y2)

                       # If this threshold resulted in a higher purity gain than
                       # previously thresholds store the threshold value and the
                       # corresponding feature index
                       if purity_gain > largest_purity_gain:
                           largest_purity_gain = purity_gain
                           best_feature_id = feature_id
                           best_threshold = threshold
                           best_X1 = X1  # X of right subtree (true)
                           best_y1 = y1  # y of right subtree (true)
                           best_X2 = X2  # X of left subtree (true)
                           best_y2 = y2  # y of left subtree (true)

       # if the resulting purity gain is good enough according our
       # pre-specified amount, then we continue growing subtrees using the
       # splitted dataset, we also increase the current_depth as
       # we go down the tree
       if largest_purity_gain > self.min_impurity:
           true_branch = self.grow_tree(best_X1,
                                        best_y1,
                                        current_depth + 1)

           false_branch = self.grow_tree(best_X2,
                                         best_y2,
                                         current_depth + 1)

           return DecisionNode(feature_id=best_feature_id,
                               threshold=best_threshold,
                               true_branch=true_branch,
                               false_branch=false_branch)

       # If none of the above conditions are met, then we have reached the
       # leaf of the tree  and we need to store the label
       leaf_value = self.majority_vote(y)

       return DecisionNode(value=leaf_value)

   def predict_value(self, x, tree=None):
       # this is a helper function for the predict method
       # it recursively goes down the tree
       # x is one instance (row) of our test dataset

       # when we don't specify the tree, we start from the root
       if tree is None:
           tree = self.root

       # if we have reached the leaf, then we just take the value of the leaf
       # as prediction
       if tree.value is not None:
           return tree.value

       # we take the feature of the current node that we are on
       # to test whether our instance satisfies the condition
       feature_value = x[tree.feature_id]

       # determine if we will follow left (false) or right (true) branch
       # down the tree
       branch = tree.false_branch
       if isinstance(feature_value, int) or isinstance(feature_value, float):
           if feature_value >= tree.threshold:
               branch = tree.true_branch
       elif feature_value == tree.threshold:
           branch = tree.true_branch

       # continue going down the tree recursively through the chosen subtree
       # this function will finish when we reach the leaves
       return self.predict_value(x, branch)

   def predict(self, X):
       # Classify samples one by one and return the set of labels
       X = np.array(X)
       y_pred = [self.predict_value(instance) for instance in X]
       return y_pred


class SVR:

    def __init__(self, epsilon=0.1, C=1, kernel_name='linear', power=2, gamma=None, coef=2):

        self.epsilon = epsilon
        self.C = C
        self.kernel_name = kernel_name
        self.power = power
        self.gamma = gamma
        self.coef = coef
        self.kernel = None
        self.alphas = None
        self.support_vectors = None
        self.support_vector_labels = None
        self.t = None


    def get_kernel(self, kernel_name):
        # you can define the three kernel functions under this method
        # and then use a dictionary with keys being the names of the kernels
        # and the values being the kernel functions with respective parameters

        def linear(x1, x2): return x1 @ x2  # YOUR CODE HERE

        def polynomial(x1, x2): return (self.gamma * x1 @ x2 + self.coef) ** self.power  # YOUR CODE HERE

        def rbf(x1, x2): return np.exp(-self.gamma * np.linalg.norm(x1 - x2) ** 2)  # YOUR CODE HERE

        kernel_functions = {'linear': linear,
                            'poly': polynomial,
                            'rbf': rbf}

        return kernel_functions[kernel_name]


    def fit(self, X, y):
        X = np.array(X)
        y = np.array(y)

        nr_samples, nr_features = np.shape(X)

        # Setting a default value for gamma
        if not self.gamma:
            self.gamma = 1 / nr_features

        # Set the kernel function
        self.kernel = self.get_kernel(self.kernel_name)

        # Construct the kernel matrix
        kernel_matrix = np.zeros((nr_samples, nr_samples))
        for i in range(nr_samples):
            for j in range(nr_samples):
                kernel_matrix[i, j] = self.kernel(X[i], X[j])  # YOUR CODE HERE

        Q = X @ X.T
        e = np.ones((X.shape[0], 1))
        eps = self.epsilon
        C = self.C
        a = cp.Variable(shape=(100, 1))
        b = cp.Variable(shape=(100, 1))

        prob = cp.Problem(cp.Minimize(1 / 2 * cp.quad_form((a - b), Q) + eps * e.T @ (a + b) - y.T @ (a - b)),
                          [a <= C * np.ones((X.shape[0], 1)),
                           a >= 0,
                           b <= C *  np.ones((X.shape[0], 1)),
                           b >= 0,
                           e.T @ (a - b) == 0])

        prob.solve()



        # Lagrange multipliers (denoted by alphas in the lecture slides)
        alphas_1 = a.value.ravel()
        alphas_2 = b.value.ravel()
        self.alphas = alphas_1 - alphas_2

        # first get indexes of non-zero lagr. multipiers
        idx = self.alphas > 1e-7

        # get the support vectors
        self.support_vectors = X[idx]

        # get the corresponding labels
        self.support_vector_labels = y[idx]

        # Calculate intercept (t) with first support vector
        self.w = self.alphas.T @ X
        self.t = 0
        self.t = self.support_vector_labels[0] - eps
        for i in range(len(self.support_vectors)):
            self.t -= self.alphas[i] * self.kernel(self.support_vectors[i], self.support_vectors[0])


    def predict(self, X):
        X = np.array(X)
        y_pred = []

        for i in range(len(X)):
            pred = self.alphas[i] * self.kernel(X[i], self.support_vectors[0])
            y_pred.append(pred + self.t)

        return np.array(y_pred)

#
#
class LogisticRegression:
   def __init__(self, learning_rate=1e-3, nr_iterations=10, batch_size=64, tol = 0.0005):
       self.learning_rate = learning_rate
       self.nr_iterations = nr_iterations
       self.batch_size = batch_size
       self.tol = tol
       self.w = None
       self.p = None
       self.losses = []

   def sigmoid(self, z):
       return 1.0 / (1 + np.exp(-z))


   def fit(self, X, y):
       X = np.array(X)
       X = np.array(X)
       X = np.insert(X, obj=0, values=np.ones((X.shape[0],)), axis=1)
       y = np.array(y).reshape(len(y), 1)
       converged = False
       i = 0

       w = tf.Variable(np.random.rand(X.shape[1], 1))
       while not converged:
           for i in range((X.shape[0] - 1) // self.batch_size + 1):
               start_i = i * self.batch_size
               end_i = start_i + self.batch_size
               xb = X[start_i:end_i]
               yb = y[start_i:end_i]
               w_old = w.numpy()
               i += 1
               with tf.GradientTape() as tape:
                   self.p = tf.sigmoid(tf.matmul(xb , w))
                   loss = (-tf.matmul(tf.transpose(tf.math.log(self.p+0.0000001)), yb) - tf.matmul(tf.transpose(tf.math.log(1 - self.p+0.0000001)), (1-yb)))
               grad = tape.gradient(loss, w)
               self.losses.append(loss)

               w.assign_sub(self.learning_rate * grad)
               w_new = w.numpy()
               if np.linalg.norm(w_new - w_old) < self.tol:
                    print("converged")
                    converged = True
                    break
           if i == self.nr_iterations:
               print('You reached max iterations')
               break

       self.w = w.numpy()
       print(f'{i} iterations')


   # YOUR CODE HERE

   def predict(self, X):
       X = np.array(X)
       X = np.insert(X, obj=0, values=np.ones((X.shape[0],)), axis=1)
       preds = self.sigmoid(np.dot(X, self.w))

       pred_class = []
       pred_class = [1 if i > 0.5 else 0 for i in preds]

       return np.array(pred_class)


#

class SoftmaxClassifier:


    def __init__(self, learning_rate=1e-3, nr_iterations=10,
    batch_size=64):
        self.learning_rate = learning_rate # learning rate for the GD
        self.nr_iterations = nr_iterations # number of iterations for GD
        self.batch_size = batch_size  # batch size for the GD
        self.bar = progressbar.ProgressBar(widgets=widgets)
        self.W = None  # weight matrix

    @staticmethod
    def softmax(z):
      return np.exp(z) / np.sum(np.exp(z))
    # write the softmax function as it is writen in the notebook
    # YOUR CODE HERE

    def fit(self, X, y):
        X = np.array(X)
        y = np.array(y)

        # insert 1s as the first feature
        X = np.insert(X, 0, 1, axis=1)

        nr_samples, nr_features = X.shape
        nr_classes = len(np.unique(y))

        # transform y into a one-hot encoded matrix and denote it with Y
        Y = np.array(pd.get_dummies(y))# YOUR CODE HERE

        # intitialize a random matrix of size (n x m) for the weights
        if self.W is None:
            self.W = 0.01 * np.random.randn(nr_features, nr_classes)

        self.loss = []
        for j in self.bar(range(self.nr_iterations)):
          # select samples from the data according to the batch size
          # Hint: you can use np.random.choice to select indices
            for i in range(X.shape[0] // self.batch_size):
                # YOUR CODE HERE
                indx = i*self.batch_size
                indx = np.random.choice(np.arange(indx, indx + self.batch_size), size = self.batch_size, replace = False)
                X_batch = X[indx, :] # n x m matrix, nr_sample := n, nr_features := m
                Y_batch = Y[indx, :] # n x k matrix, nr_classes := k

                  # get the probability matrix (p) using X_batch and the current W matrix
                  # Hint: you need to apply softmax function to get probabilities
                  # it will be a matrix of size n x k
                p = SoftmaxClassifier.softmax(X_batch @ self.W )

                # get the loss (matrix) using the log(p) and Y_batch
                # think about the loss function formula (L) as a dot product
                # it will be a matrix of size n x n,
                # where the diagonals are the losses per sample point
                loss_matrix = -Y_batch @ np.log(p+0.000000001).T
                # YOUR CODE HERE

                # get the average loss across the batch
                loss = np.mean(loss_matrix.diagonal())

                # compute the gradient using the last formula in the notebook
                # don't forget to normalize the gradient with the batch size
                # since we took the normalized cross-entropy (mean instead of sum)
                # think about the gradient as a dot product
                # the result should be an m x k matrix (the same size as W)
                gradient = (X_batch.T @ (p - Y_batch)) / self.batch_size
                self.W -= self.learning_rate * gradient
                self.loss.append(loss)

    def predict(self, X):
        X = np.array(X)
        X = np.insert(X, 0, 1, axis=1)

        # use the weight matrix W to obtain the probabilities with softmax
        prob = SoftmaxClassifier.softmax(X @ self.W )
        pred_class = [np.argmax(i) for i in prob]# YOUR CODE HERE n x k matrix
        # get the index of the highest probability per row as the prediction
        # you may want to use np.argmax here
        return np.array(pred_class) # YOUR CODE HERE

  #
