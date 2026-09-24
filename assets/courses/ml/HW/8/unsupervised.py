import numpy as np


class KMeans:
    def __init__(self, k=2, max_iterations=500, tol=0.5):
        # number of clusters
        self.k = k
        # maximum number of iterations to perform
        # for updating the centroids
        self.max_iterations = max_iterations
        # tolerance level for centroid change after each iteration
        self.tol = tol
        # we will store the computed centroids
        self.centroids = None

    def init_centroids(self, X):
        # this function initializes the centroids
        # by choosing self.k points from the dataset
        # Hint: you may want to use the np.random.choice function
        indx = np.random.choice(np.arange(X.shape[0]), size=k, replace=False)
        centroids = [ X[i] for i in indx ]# YOUR CODE HERE
        return np.array(centroids)

    def closest_centroid(self, X):
        X = np.array(X)
        # this function computes the distance (euclidean) between
        # each point in the dataset from the centroids filling the values
        # in a distance matrix (dist_matrix) of size n x k
        # Hint: you may want to remember how we solved the warm-up exercise
        # in Programming module (Python_Numpy2 file)
        dist_matrix = X @ self.centroids.T
        dist_matrix = np.sqrt(dist_matrix)
        # after constructing the distance matrix, you should return
        # the index of minimal value per row
        # Hint: you may want to use np.argmin function
        return np.argmin(dist_matrix, axis = 1)

    def update_centroids(self, X, label_ids):
        # this function updates the centroids (there are k centroids)
        # by taking the average over the values of X for each label (cluster)
        # here label_ids are the indices returned by closest_centroid function


        # YOUR CODE HERE
        return new_centroids

    def fit(self, X):
        # this is the main method of this class
        X = np.array(X)
        # we start by random centroids from our data
        self.centroids = self.init_centroids(X)

        not_converged = True
        i = 1 # keeping track of the iterations
        while not_converged and (i < self.max_iterations):
            current_labels = self.closest_centroid(X)
            new_centroids = self.update_centroids(X, current_labels)

            # count the norm between new_centroids and self.centroids
            # to measure the amount of change between
            # old cetroids and updated centroids
            norm = # YOUR CODE HERE
            not_converged = norm > self.tol
            self.centroids = new_centroids
            i += 1
        self.labels = current_labels
        print(f'Converged in {i} steps')

    def predict(self, X):
        # we can also have a method, which takes a new instance (instances)
        # and assigns a cluster to it, by calculating the distance
        # between that instance and the fitted centroids
        # returns the index (indices) of of the cluster labels for each instance
        X = np.array(X)
        return # YOUR CODE HERE


class HierarchicalClustering:
    def __init__(self, nr_clusters, diss_func, linkage='single', distance_threshold=None):
        # nr_clusters is the number of clusters to find from the data
        # if distance_treshold is None, nr_clusters should be provided
        # and if distance_threshold is provided, then we stop
        # forming clusters when we reach the specified threshold
        # diss_func is the dissimilarity measure to compute the
        # dissimilarity/distance between two data points
        # linkage method should be one of the following {single, complete, average}
        # YOUR CODE HERE

    def fit(self, X):
        # YOUR CODE HERE

    def predict(self, X):
        # YOUR CODE HERE


class DBSCAN:
    def __init__(self, diss_func, epsilon=0.5, min_points=5):
        # epsilon is the maximum distance/dissimilarity between two points
        # to be considered as in the neighborhood of each other
        # min_ponits is the number of points in a neighborhood for
        # a point to be considered as a core point (a member of a cluster).
        # This includes the point itself.
        # diss_func is the dissimilarity measure to compute the
        # dissimilarity/distance between two data points
        # YOUR CODE HERE

    def fit(self, X):
        # noise should be labeled as "-1" cluster
        # YOUR CODE HERE

    def predict(self, X):
        # YOUR CODE HERE


class PCA:
    def __init__(self, nr_components):
        self.nr_components = nr_components

        # we will store the PC coordinates here
        self.components = None
        # how much variance is explained with the PCs
        self.explained_variance = None
        # how much variance is explained with the PCs among the total variance
        self.explained_variance_ratio = None

    def fit(self, X):
        # this method is used to compute the PC components (projection matrix)
        nr_components = self.nr_components

        # compute the covariance matrix of the given dataset
        # note that we are interested in covariance in terms of the
        # features (columns) of our dataset
        covariance_matrix = # YOUR CODE HERE

        # get the eigenvalues and eigenvectors of the covariance matrix
        eigenvalues, eigenvectors = # YOUR CODE HERE

        # get the indices of the first nr_components eigenvalues
        idx = # YOUR CODE HERE
        self.explained_variance = sum(eigenvalues[idx][:nr_components])
        self.explained_variance_ratio = self.explained_variance / sum(eigenvalues)

        # select the first nr_components eigenvectors as the projection matrix
        self.components = # YOUR CODE HERE

    def transform(self, X):
        # this method will project the initial data to the new subspace
        # spanned with the principal components, here you will need self.components
        return # YOUR CODE HERE

    def fit_transform(self, X):
        self.fit(X)
        return self.transform(X)


class TSNE:
    # Implement t-SNE according to the the Algorithm 1 (pseudocode) 
    # from the original paper 
    # https://www.jmlr.org/papers/volume9/vandermaaten08a/vandermaaten08a.pdf
    def __init__(self):
        # YOUR CODE HERE

    def fit(self, X):
        # Fit X into an embedded space
        # YOUR CODE HERE

    def fit_transform(self, X):
        # Fit X into an embedded space and return that transformed output
        # YOUR CODE HERE
